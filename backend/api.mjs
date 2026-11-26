import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { analyzeHistory } from './cycle-intelligence.mjs';
import { answerCare } from './companion.mjs';
import { buildReport, reportFileName, reportRangeError } from '../src/report-data.js';
import { createReportCsv, createReportPdf } from './report-export.mjs';
import { rateLimiter, requestOriginAllowed } from './security.mjs';

const derive = promisify(scrypt);
const sessionSeconds = 12 * 60 * 60;
const idleMs = 30 * 60 * 1000;
const authScrypt = { N:32768, r:8, p:3, maxmem:48 * 1024 * 1024 };
const moods = ['Radiant', 'Calm', 'Tender', 'Tired', 'Low'];
const symptoms = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Fatigue'];
const tracking = ['cycle', 'wellness', 'both'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const sha = value => createHash('sha256').update(value).digest('hex');
const saltFallback = '00000000000000000000000000000000';
const recoveryCode = () => randomBytes(24).toString('base64url');

class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validate(condition, message) {
  if (!condition) throw new ClientError(400, message);
}

function text(value, label, min, max) {
  validate(typeof value === 'string', `${label} is required.`);
  const clean = value.trim();
  validate(clean.length >= min && clean.length <= max, `${label} must have ${min} to ${max} characters.`);
  return clean;
}

function number(value, label, min, max, optional = false) {
  if (value == null && optional) return null;
  validate(Number.isInteger(value) && value >= min && value <= max, `${label} must be between ${min} and ${max}.`);
  return value;
}

function fromList(value, choices, label) {
  validate(choices.includes(value), `Choose a valid ${label}.`);
  return value;
}

function date(value, today = localDay()) {
  validate(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date.');
  const parsed = new Date(value + 'T00:00:00Z');
  validate(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= today, 'Choose a valid date on or before today.');
  return value;
}

function localDay() {
  const today = new Date();
  return [today.getFullYear(), today.getMonth() + 1, today.getDate()].map(part => String(part).padStart(2, '0')).join('-');
}

function email(value) {
  const address = text(value, 'Email', 3, 254).toLowerCase();
  validate(emailPattern.test(address), 'Enter a valid email.');
  return address;
}

function password(value) {
  validate(typeof value === 'string' && value.length >= 10 && value.length <= 128, 'Password must have 10 to 128 characters.');
  return value;
}

async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  return 's2:' + salt + ':' + (await derive(value, salt, 64, authScrypt)).toString('hex');
}

async function matchesPassword(value, hash) {
  const legacy = hash && !hash.startsWith('s2:');
  const [salt, stored] = hash?.replace(/^s2:/, '').split(':') ?? [saltFallback, '0'.repeat(128)];
  const actual = await derive(value, salt, 64, legacy ? {} : authScrypt);
  return Boolean(hash && timingSafeEqual(actual, Buffer.from(stored, 'hex')));
}

function reply(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ClientError(415, 'Send JSON data.');
  }
  const parts = [];
  let length = 0;
  for await (const part of request.iterator({ destroyOnReturn: false })) {
    length += part.length;
    if (length > 8192) {
      request.resume();
      throw new ClientError(413, 'Request is too large.');
    }
    parts.push(part);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Respond consistently to malformed or non-object JSON.
  }
  throw new ClientError(400, 'Send a JSON object.');
}

function tokenFromRequest(request, cookieName) {
  const token = (request.headers.cookie ?? '').split(';').map(pair => pair.trim())
    .find(pair => pair.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return token && /^[\w-]{43}$/.test(token) ? sha(token) : null;
}

function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createApi(db, routeTopic = null, { origin, clock = Date.now } = {}) {
  const now = clock;
  const secure = Boolean(origin);
  const cookieName = secure ? '__Host-lunara_session' : 'lunara_session';
  const limiter = rateLimiter(now);
  const byEmail = db.prepare('SELECT * FROM users WHERE email=?');
  const bySession = db.prepare('SELECT u.*,s.last_seen FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND s.last_seen>?');
  const touchSession = db.prepare('UPDATE sessions SET last_seen=? WHERE token=?');
  const auditInsert = db.prepare('INSERT INTO audit_events VALUES(?,?,?,?)');
  const auditPrune = db.prepare('DELETE FROM audit_events WHERE happened_at<?');
  const recordConsent = db.prepare('INSERT INTO privacy_events VALUES(?,?,?,?)');
  const latestConsentEvent = db.prepare('SELECT max(rowid) AS revision FROM privacy_events WHERE user_id=?');
  let nextAuditPrune = 0;
  let passwordWork = 0;

  function session(token, touch = false) {
    if (!token) return null;
    const at = now();
    const user = bySession.get(token, at, at - idleMs);
    if (user && touch && at - user.last_seen >= 60_000) touchSession.run(at, token);
    return user;
  }

  function limit(response, key, count, duration = 60_000) {
    if (limiter(key, count, duration)) return;
    response.setHeader('Retry-After', String(Math.ceil(duration / 1000)));
    throw new ClientError(429, 'Too many requests. Wait and try again.');
  }

  async function withPasswordWork(action) {
    if (passwordWork >= 4) throw new ClientError(429, 'Sign-in checks are busy. Try again shortly.');
    passwordWork++;
    try { return await action(); } finally { passwordWork--; }
  }

  function audit(event, outcome, userId = null) {
    try {
      const at = now();
      if (at >= nextAuditPrune) {
        auditPrune.run(new Date(at - 90 * 86_400_000).toISOString());
        nextAuditPrune = at + 86_400_000;
      }
      auditInsert.run(new Date(at).toISOString(), event, outcome, userId ? sha('audit:' + userId) : null);
    } catch {
      console.error('LUNARA audit event could not be stored');
    }
  }

  function consent(userId, action) {
    recordConsent.run(userId, action, 'tracking-v2', new Date(now()).toISOString());
  }

  function setCookie(response, token, maxAge) {
    response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
  }

  function issueSession(response, id, previous, createUser = null) {
    const raw = randomBytes(32).toString('base64url');
    transaction(db, () => {
      if (createUser) createUser();
      const at = now();
      db.prepare('DELETE FROM sessions WHERE expires<=? OR last_seen<=? OR token=?').run(at, at - idleMs, previous);
      db.prepare('INSERT INTO sessions(token,user_id,expires,last_seen) VALUES(?,?,?,?)').run(sha(raw), id, at + sessionSeconds * 1000, at);
    });
    setCookie(response, raw, sessionSeconds);
  }

  function trackingRecords(userId) {
    return {
      cycles: db.prepare('SELECT start_date AS start, end_date AS end, source FROM cycles WHERE user_id=? ORDER BY start_date DESC').all(userId),
      moods: db.prepare('SELECT date,mood,energy,stress FROM mood_logs WHERE user_id=? ORDER BY date DESC').all(userId),
      symptoms: db.prepare('SELECT name,severity,date,time FROM symptom_logs WHERE user_id=? ORDER BY date DESC,time DESC,rowid DESC').all(userId),
      sleep: db.prepare('SELECT date,minutes,quality FROM sleep_logs WHERE user_id=? ORDER BY date DESC').all(userId),
    };
  }

  function snapshot(user) {
    const records = {
      user: {
        id: user.id, name: user.name, email: user.email, reduceMotion: Boolean(user.motion), tracking: user.tracking,
        consent: Boolean(user.consent_at), onboarded: Boolean(user.onboarding_complete),
        cycleLength: user.cycle_length, periodLength: user.period_length,
      },
      ...trackingRecords(user.id),
      journal: db.prepare('SELECT note,date FROM journal_logs WHERE user_id=? ORDER BY date DESC,rowid DESC').all(user.id),
    };
    return { ...records, analysis:user.consent_at ? analyzeHistory(records, localDay()) : null };
  }

  async function sendReport(response, user, token, body) {
    if (!user.onboarding_complete) throw new ClientError(403, 'Complete tracking setup before exporting reports.');
    const format = fromList(body.format, ['pdf','csv'], 'file format');
    const today = localDay();
    const rangeError = reportRangeError(body, today);
    validate(!rangeError, rangeError);
    if (body.includeNotes !== undefined) validate(typeof body.includeNotes === 'boolean', 'Choose whether to include journal notes.');
    const includeNotes = body.includeNotes === true;
    const records = trackingRecords(user.id);
    if (includeNotes) records.journal = db.prepare('SELECT date,note FROM journal_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date,rowid')
      .all(user.id, body.from, body.to);
    records.analysis = analyzeHistory({ cycles:records.cycles }, today);
    const report = buildReport(records, { from:body.from, to:body.to, includeNotes });
    const bytes = format === 'pdf' ? await createReportPdf(report) : createReportCsv(report);
    if (session(token)?.id !== user.id) throw new ClientError(401, 'Sign in to continue.');
    audit('report-export', 'success', user.id);
    response.writeHead(200, {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportFileName(report, format)}"`,
      'Content-Length':bytes.length,
      'Cache-Control':'no-store, private',
    });
    response.end(bytes);
  }

  const threadRevision = db.prepare('SELECT revision FROM ai_threads WHERE user_id=?');
  const recentTurns = db.prepare('SELECT id,question,reply,language,history_used AS historyUsed,created_at AS createdAt FROM ai_turns WHERE user_id=? ORDER BY rowid DESC LIMIT 40');
  const initThread = db.prepare('INSERT INTO ai_threads(user_id) VALUES(?) ON CONFLICT(user_id) DO NOTHING');
  const existingTurn = db.prepare('SELECT 1 FROM ai_turns WHERE user_id=? AND id=?');
  const lastTopic = db.prepare("SELECT json_extract(reply,'$.topic') AS topic FROM ai_turns WHERE user_id=? ORDER BY rowid DESC LIMIT 1");
  const revisionFor = userId => threadRevision.get(userId)?.revision ?? 0;

  function thread(userId) {
    const turns = recentTurns.all(userId).reverse().map(row => ({ ...row, reply: JSON.parse(row.reply), historyUsed: Boolean(row.historyUsed) }));
    return { revision: revisionFor(userId), turns, modelConfigured: Boolean(routeTopic) };
  }

  function ensureRevision(userId, revision) {
    validate(Number.isSafeInteger(revision) && revision >= 0, 'Invalid conversation revision.');
    if (revision !== revisionFor(userId)) throw new ClientError(409, 'This conversation changed in another tab. Reload the page before continuing.');
  }

  async function sendCare(user, body, token) {
    const id = recordId(body.id);
    const question = text(body.question, 'Question', 1, 1200);
    const language = fromList(body.language, ['en','id'], 'reply language');
    if (body.includeHistory !== undefined) validate(typeof body.includeHistory === 'boolean', 'Choose whether to include your history.');
    ensureRevision(user.id, body.revision);
    if (existingTurn.get(user.id, id)) return thread(user.id);
    const previousTopic = lastTopic.get(user.id)?.topic;
    const consentRevision = latestConsentEvent.get(user.id).revision;
    const checkConsent = () => {
      const active = session(token);
      if (active?.id !== user.id) throw new ClientError(401, 'Sign in to continue.');
      if (!active.consent_at || latestConsentEvent.get(user.id).revision !== consentRevision) {
        throw new ClientError(403, 'Tracking consent changed. Reload and try again.');
      }
    };
    const answer = await answerCare({
      question, language, includeHistory: body.includeHistory === true, previousTopic, routeTopic,
      readHistory: () => {
        checkConsent();
        return analyzeHistory(trackingRecords(user.id), localDay());
      },
    });
    checkConsent();
    transaction(db, () => {
      ensureRevision(user.id, body.revision);
      initThread.run(user.id);
      db.prepare('INSERT INTO ai_turns VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING')
        .run(user.id, id, question, JSON.stringify(answer), language, Number(Boolean(answer.context)), new Date().toISOString());
    });
    return thread(user.id);
  }

  function clearCare(user, body) {
    transaction(db, () => {
      ensureRevision(user.id, body.revision);
      initThread.run(user.id);
      db.prepare('DELETE FROM ai_turns WHERE user_id=?').run(user.id);
      db.prepare('UPDATE ai_threads SET revision=revision+1 WHERE user_id=?').run(user.id);
    });
    return thread(user.id);
  }

  function changeConsent(user, body) {
    validate(user.onboarding_complete === 1, 'Finish the initial setup before changing tracking consent.');
    validate(typeof body.granted === 'boolean', 'Confirm the new consent choice.');
    if (Boolean(user.consent_at) === body.granted) return;
    transaction(db, () => {
      db.prepare('UPDATE users SET consent_at=? WHERE id=?').run(body.granted ? new Date(now()).toISOString() : null, user.id);
      consent(user.id, body.granted ? 'granted' : 'withdrawn');
    });
    audit(body.granted ? 'consent-granted' : 'consent-withdrawn', 'success', user.id);
  }

  async function verifyPrivilegedAction(response, user, token, body) {
    limit(response, 'privacy:' + user.id, 6, 5 * 60_000);
    const secret = password(body.password);
    const valid = await withPasswordWork(() => matchesPassword(secret, user.password));
    const active = session(token);
    if (active?.id !== user.id) throw new ClientError(401, 'Sign in to continue.');
    if (!valid || active.password !== user.password) {
      audit('privacy-verification', 'denied', user.id);
      throw new ClientError(403, 'Password verification failed.');
    }
  }

  function exportAccount(response, user) {
    const { analysis, ...records } = snapshot(user);
    const turns = db.prepare('SELECT question,reply,language,history_used AS historyUsed,created_at AS createdAt FROM ai_turns WHERE user_id=? ORDER BY rowid').all(user.id)
      .map(row => ({ ...row, reply:JSON.parse(row.reply), historyUsed:Boolean(row.historyUsed) }));
    const consentHistory = db.prepare('SELECT action,policy,happened_at AS happenedAt FROM privacy_events WHERE user_id=? ORDER BY rowid').all(user.id);
    const bytes = Buffer.from(JSON.stringify({ version:1, exportedAt:new Date(now()).toISOString(), ...records, consentHistory, conversation:turns }, null, 2), 'utf8');
    audit('account-export', 'success', user.id);
    response.writeHead(200, {
      'Content-Type':'application/json; charset=utf-8', 'Content-Length':bytes.length,
      'Cache-Control':'no-store, private', 'Content-Disposition':'attachment; filename="lunara-account-data.json"',
    });
    response.end(bytes);
  }

  function deleteAccount(response, user) {
    transaction(db, () => {
      db.prepare('DELETE FROM audit_events WHERE subject=?').run(sha('audit:' + user.id));
      db.prepare('DELETE FROM users WHERE id=?').run(user.id);
    });
    audit('account-delete', 'success');
    setCookie(response, '', 0);
    reply(response, 200, { user:null });
  }

  const write = {
    '/api/preferences'(user, body) {
      const name = text(body.name, 'Display name', 1, 60);
      const mode = fromList(body.tracking, tracking, 'tracking preference');
      const cycleLength = number(body.cycleLength, 'Typical cycle length', 1, 365, true);
      const periodLength = number(body.periodLength, 'Typical period length', 1, 365, true);
      const complete = body.complete === true && !user.onboarding_complete;
      if (complete) validate(body.consent === true || Boolean(user.consent_at), 'Confirm consent before finishing setup.');
      const start = complete && body.lastPeriod ? date(body.lastPeriod) : null;
      transaction(db, () => {
        db.prepare(`UPDATE users SET name=?,motion=?,tracking=?,cycle_length=?,period_length=?,
          consent_at=coalesce(consent_at,?),onboarding_complete=max(onboarding_complete,?) WHERE id=?`)
          .run(name, Number(body.reduceMotion === true), mode, cycleLength, periodLength, complete ? new Date(now()).toISOString() : null, Number(complete), user.id);
        if (complete && !user.consent_at) consent(user.id, 'granted');
        if (start && !user.onboarding_complete) {
          db.prepare("INSERT INTO cycles(user_id,start_date,end_date,source) VALUES(?,?,?,'start-only') ON CONFLICT(user_id,start_date) DO NOTHING").run(user.id, start, start);
        }
      });
    },
    '/api/period'(user, body) {
      const start = date(body.start);
      const end = body.end == null || body.end === '' ? null : date(body.end);
      validate(end === null || end >= start, 'The end date must be on or after the start date.');
      const previous = body.previous ? date(body.previous) : start;
      transaction(db, () => {
        const conflict = db.prepare('SELECT 1 FROM cycles WHERE user_id=? AND start_date<>? AND start_date<=? AND coalesce(end_date,?)>=?')
          .get(user.id, previous, end ?? localDay(), localDay(), start);
        validate(!conflict, 'This period overlaps a saved period. Edit that entry instead.');
        if (previous !== start) db.prepare('DELETE FROM cycles WHERE user_id=? AND start_date=?').run(user.id, previous);
        db.prepare("INSERT INTO cycles(user_id,start_date,end_date,source) VALUES(?,?,?,'range') ON CONFLICT(user_id,start_date) DO UPDATE SET end_date=excluded.end_date,source=excluded.source").run(user.id, start, end);
      });
    },
    '/api/period/remove'(user, body) {
      db.prepare('DELETE FROM cycles WHERE user_id=? AND start_date=?').run(user.id, date(body.start));
    },
    '/api/mood'(user, body) {
      const day = date(body.date);
      const mood = fromList(body.mood, moods, 'mood');
      const prior = db.prepare('SELECT energy,stress FROM mood_logs WHERE user_id=? AND date=?').get(user.id, day);
      const energy = body.energy === undefined ? prior?.energy ?? null : number(body.energy, 'Energy', 1, 5, true);
      const stress = body.stress === undefined ? prior?.stress ?? null : number(body.stress, 'Stress', 1, 5, true);
      db.prepare('INSERT INTO mood_logs VALUES(?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET mood=excluded.mood,energy=excluded.energy,stress=excluded.stress')
        .run(user.id, day, mood, energy, stress);
    },
    '/api/journal'(user, body) {
      const id = recordId(body.id);
      const day = date(body.date);
      const note = text(body.note, 'Journal entry', 1, 500);
      db.prepare('INSERT INTO journal_logs VALUES(?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').run(user.id, id, day, note);
    },
    '/api/symptom'(user, body) {
      const id = recordId(body.id);
      const day = date(body.date);
      validate(typeof body.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time), 'Choose a valid time.');
      const name = body.name === 'Other' ? text(body.custom, 'Custom symptom', 1, 60) : fromList(body.name, symptoms, 'symptom');
      const severity = fromList(body.severity, ['Mild', 'Moderate', 'Severe'], 'severity');
      db.prepare('INSERT INTO symptom_logs VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').run(user.id, id, day, body.time, name, severity);
    },
    '/api/sleep'(user, body) {
      const day = date(body.date);
      const minutes = number(body.minutes, 'Sleep duration in minutes', 0, 1440);
      const quality = fromList(body.quality, ['Restful', 'Mixed', 'Poor'], 'sleep quality');
      db.prepare('INSERT INTO sleep_logs VALUES(?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET minutes=excluded.minutes,quality=excluded.quality')
        .run(user.id, day, minutes, quality);
    },
  };

  async function authenticate(path, request, response, body, previous) {
    limit(response, 'auth-ip:' + request.socket.remoteAddress, 30);
    const address = email(body.email);
    limit(response, 'auth-email:' + sha(address), 12);
    const secret = password(body.password);
    if (path === '/api/register') {
      const id = randomUUID();
      const code = recoveryCode();
      const hash = await hashPassword(secret);
      const name = text(body.name, 'Display name', 1, 60);
      issueSession(response, id, previous, () => {
        const result = db.prepare('INSERT INTO users(id,email,password,recovery,name) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING')
          .run(id, address, hash, sha(code), name);
        if (!result.changes) throw new ClientError(409, 'An account with that email already exists.');
      });
      audit('register', 'success', id);
      reply(response, 201, { ...snapshot(byEmail.get(address)), recoveryCode: code });
      return;
    }
    const user = byEmail.get(address);
    if (path === '/api/login') {
      const valid = await matchesPassword(secret, user?.password);
      const upgrade = valid && !user.password.startsWith('s2:') ? await hashPassword(secret) : null;
      if (!valid || byEmail.get(address)?.password !== user.password) throw new ClientError(401, 'Email or password is incorrect.');
      issueSession(response, user.id, previous, upgrade ? () => db.prepare('UPDATE users SET password=? WHERE id=?').run(upgrade, user.id) : null);
      audit('login', 'success', user.id);
      reply(response, 200, snapshot(user));
      return;
    }
    const code = text(body.recoveryCode, 'Recovery code', 32, 32);
    if (!user || !timingSafeEqual(Buffer.from(sha(code), 'hex'), Buffer.from(user.recovery, 'hex'))) {
      throw new ClientError(401, 'Email or recovery code is incorrect.');
    }
    const rotated = recoveryCode();
    const hash = await hashPassword(secret);
    transaction(db, () => {
      const change = db.prepare('UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?').run(hash, sha(rotated), user.id, user.recovery);
      if (!change.changes) throw new ClientError(401, 'That recovery code has already been used.');
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    });
    audit('recover', 'success', user.id);
    reply(response, 200, { recoveryCode: rotated });
  }

  return async function api(request, response, path) {
    try {
      const token = tokenFromRequest(request, cookieName);
      if (path === '/api/session' && request.method === 'GET') {
        const user = session(token, true);
        reply(response, 200, user ? snapshot(user) : { user: null });
        return;
      }
      if (path === '/api/companion' && request.method === 'GET') {
        const user = session(token, true);
        if (!user) throw new ClientError(401, 'Sign in to continue.');
        if (request.headers['x-lunara-account'] !== user.id) throw new ClientError(409, 'Your account changed in another tab. Reload and try again.');
        if (!user.onboarding_complete) throw new ClientError(403, 'Complete tracking setup before using AI Care.');
        reply(response, 200, thread(user.id));
        return;
      }
      if (request.method !== 'POST') throw new ClientError(405, 'Method not allowed.');
      if (!requestOriginAllowed(request, origin)) throw new ClientError(403, 'Request origin is not allowed.');
      const body = await readJson(request);
      if (['/api/register', '/api/login', '/api/recover'].includes(path)) {
        await withPasswordWork(() => authenticate(path, request, response, body, token));
        return;
      }
      if (path === '/api/logout') {
        const user = session(token);
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
        setCookie(response, '', 0);
        if (user) audit('logout', 'success', user.id);
        reply(response, 200, { user: null });
        return;
      }
      const user = session(token, true);
      if (!user) throw new ClientError(401, 'Sign in to continue.');
      if (request.headers['x-lunara-account'] !== user.id) {
        throw new ClientError(409, 'Your account changed in another tab. Reload and try again.');
      }
      const [routeClass, quota] = path === '/api/report/export' ? ['export',12] : path === '/api/companion' ? ['care',12] : ['write',90];
      limit(response, routeClass + ':' + user.id, quota);
      if (path === '/api/privacy/consent') {
        changeConsent(user, body);
        reply(response, 200, snapshot(byEmail.get(user.email)));
        return;
      }
      if (path === '/api/privacy/export' || path === '/api/privacy/delete') {
        if (path === '/api/privacy/delete') validate(body.confirmation === 'DELETE', 'Type DELETE to confirm account deletion.');
        await verifyPrivilegedAction(response, user, token, body);
        if (path === '/api/privacy/export') exportAccount(response, user);
        else deleteAccount(response, user);
        return;
      }
      if (path === '/api/report/export') {
        await sendReport(response, user, token, body);
        return;
      }
      if (path === '/api/companion' || path === '/api/companion/clear') {
        if (path === '/api/companion' && !user.consent_at) throw new ClientError(403, 'Tracking consent is paused. Resume it in Privacy & data before sending.');
        if (!user.onboarding_complete) throw new ClientError(403, 'Complete tracking setup before using AI Care.');
        const data = path === '/api/companion' ? await sendCare(user, body, token) : clearCare(user, body);
        if (path === '/api/companion/clear') audit('conversation-clear', 'success', user.id);
        reply(response, 200, data);
        return;
      }
      const action = Object.hasOwn(write, path) ? write[path] : null;
      if (!action) throw new ClientError(404, 'Route not found.');
      if (path !== '/api/preferences' && !user.consent_at) throw new ClientError(403, 'Complete tracking setup before saving health entries.');
      action(user, body);
      reply(response, 200, snapshot(byEmail.get(user.email)));
    } catch (error) {
      if (error instanceof ClientError) {
        if (['/api/register','/api/login','/api/recover'].includes(path) && [401,409,429].includes(error.status)) {
          audit('authentication', error.status === 429 ? 'rate-limited' : 'denied');
        }
        reply(response, error.status, { error: error.message });
      }
      else {
        console.error('LUNARA API operation failed', error.code ?? error.name);
        reply(response, 500, { error: 'Could not complete that request.' });
      }
    }
  };
}

function recordId(value) {
  validate(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), 'Invalid entry identifier.');
  return value.toLowerCase();
}
