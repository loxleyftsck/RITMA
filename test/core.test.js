import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appServer } from '../server.mjs';

async function listen(database, careRouter, clock) {
  const server = appServer({ database, careRouter, clock });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    async call(path, { body, session, account, site = origin } = {}) {
      const headers = {};
      if (session) headers.Cookie = session.cookie;
      if (account ?? session?.account) headers['X-Lunara-Account'] = account ?? session.account;
      if (body !== undefined) Object.assign(headers, { Origin: site, 'Content-Type': 'application/json' });
      const response = await fetch(origin + '/api/' + path, {
        headers, method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
      });
      const isJson = response.headers.get('content-type')?.startsWith('application/json');
      const json = isJson ? await response.json() : null;
      const bytes = isJson ? null : Buffer.from(await response.arrayBuffer());
      return { status: response.status, json, bytes, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0], account: json?.user?.id };
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

const registration = { email: 'demo@example.test', name: 'Demo', password: 'Local demo input 123' };
const setup = { name: 'Demo', tracking: 'both', cycleLength: 31, periodLength: 5, complete: true, consent: true };
const day = '2024-02-29';

test('tracking records and sessions persist through restart and stay isolated by account', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lunara-core-'));
  const database = join(directory, 'test.sqlite');
  let server = await listen(database);
  try {
    assert.equal((await server.call('session')).json.user, null);
    assert.equal((await server.call('sleep', { body: { date: day } })).status, 401);
    assert.equal((await server.call('register', { body: registration, site: 'https://example.test' })).status, 403);

    const first = await server.call('register', { body: registration });
    assert.equal(first.status, 201);
    assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.equal(first.json.user.onboarded, false);
    assert.equal((await server.call('register', { body: registration })).status, 409);

    const call = (path, body) => server.call(path, { body, session: first });
    assert.equal((await call('period', { start: day })).status, 403);
    assert.equal((await call('preferences', { ...setup, consent: false })).status, 400);
    const preferences = await call('preferences', { ...setup, lastPeriod: '2024-01-31' });
    assert.equal(preferences.status, 200);
    assert.equal(preferences.json.user.cycleLength, 31);
    assert.deepEqual(preferences.json.cycles, [{ start: '2024-01-31', end: '2024-01-31', source: 'start-only' }]);
    assert.equal(preferences.json.analysis.cycle.medianPeriodDays, null);
    assert.equal((await call('period', { start: '2024-02-30' })).status, 400);
    assert.equal((await call('period', { start: day, end: '2024-02-28' })).status, 400);
    assert.equal((await call('period', { start: day, end: '2024-03-04' })).status, 200);
    assert.equal((await call('period', { start: '2024-03-01', end: '2024-03-05' })).status, 400);
    assert.equal((await call('period', { previous: day, start: day, end: '2024-03-05' })).json.cycles[0].end, '2024-03-05');
    assert.equal((await call('mood', { date: day, mood: 'Calm', energy: 4, stress: 2 })).status, 200);
    assert.equal((await call('mood', { date: day, mood: 'Tender' })).json.moods[0].energy, 4);
    const note = { id: randomUUID(), date: day, note: 'Felt rested.' };
    assert.equal((await call('journal', note)).status, 200);
    assert.equal((await call('journal', note)).json.journal.length, 1);
    assert.equal((await call('symptom', { id: randomUUID(), date: day, time: '09:18', name: 'Other', custom: 'Example discomfort', severity: 'Moderate' })).status, 200);
    assert.equal((await call('sleep', { date: day, minutes: 440, quality: 'Restful' })).status, 200);

    await server.close();
    server = await listen(database);
    const restored = await server.call('session', { session: first });
    assert.equal(restored.json.user.id, first.account);
    assert.equal(restored.json.user.onboarded, true);
    assert.deepEqual([restored.json.cycles.length, restored.json.moods.length, restored.json.journal.length, restored.json.symptoms.length, restored.json.sleep.length], [2, 1, 1, 1, 1]);
    assert.equal(restored.json.symptoms[0].time, '09:18');
    assert.equal(restored.json.sleep[0].minutes, 440);
    assert.equal(restored.json.analysis.cycle.medianDays, 29);
    assert.equal(restored.json.analysis.cycle.medianPeriodDays, 6);
    assert.equal((await call('period/remove', { start: day })).json.cycles.length, 1);

    const second = await server.call('register', { body: { ...registration, email: 'separate@example.test' } });
    const isolated = await server.call('session', { session: second });
    for (const list of ['cycles','moods','journal','symptoms','sleep']) assert.deepEqual(isolated.json[list], []);
    assert.equal(isolated.json.analysis, null);
    assert.equal((await server.call('preferences', { body: setup, session: second, account: first.account })).status, 409);
    assert.equal((await call('logout', {})).status, 200);
    assert.equal((await server.call('session', { session: first })).json.user, null);
    const relogged = await server.call('login', { body: registration });
    assert.equal(relogged.status, 200);
    assert.equal(relogged.json.journal[0].note, note.note);
  } finally {
    await server.close();
    for (const suffix of ['', '-shm', '-wal']) await rm(database + suffix, { force: true });
    await rmdir(directory);
  }
});

test('privacy controls scope portable data, withdraw consent, and remove all active account records', async () => {
  const server = await listen(':memory:');
  try {
    const owner = await server.call('register', { body:registration });
    const post = (path, body) => server.call(path, { session:owner, body });
    await post('preferences', setup);
    await post('journal', { id:randomUUID(), date:day, note:'Synthetic private note' });
    await post('companion', { id:randomUUID(), revision:0, question:'How do sleep logs work?', language:'en' });
    const paused = await post('privacy/consent', { granted:false });
    assert.equal(paused.json.user.consent, false);
    assert.equal(paused.json.analysis, null);
    assert.equal((await post('journal', { id:randomUUID(), date:day, note:'another' })).status, 403);
    assert.equal((await post('companion', { id:randomUUID(), revision:0, question:'How do sleep logs work?', language:'en', includeHistory:true })).status, 403);
    assert.equal((await post('preferences', setup)).json.user.consent, false);
    assert.equal((await post('privacy/export', { password:'Another demo password' })).status, 403);
    const exported = await post('privacy/export', { password:registration.password });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /lunara-account-data.json/);
    assert.equal(exported.json.journal[0].note, 'Synthetic private note');
    assert.equal(exported.json.conversation.length, 1);
    assert.deepEqual(exported.json.consentHistory.map(row => row.action), ['granted','withdrawn']);
    assert.doesNotMatch(JSON.stringify(exported.json), /recoveryCode|lunara_session|password/);
    assert.equal((await post('privacy/consent', { granted:true })).json.user.consent, true);
    assert.equal((await post('privacy/delete', { password:registration.password, confirmation:'keep' })).status, 400);
    const deleted = await post('privacy/delete', { password:registration.password, confirmation:'DELETE' });
    assert.equal(deleted.status, 200);
    assert.match(deleted.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await server.call('session', { session:owner })).json.user, null);
    const replacement = await server.call('register', { body:registration });
    assert.equal(replacement.status, 201);
    assert.deepEqual(replacement.json.journal, []);
    await server.call('preferences', { session:replacement, body:setup });
    assert.deepEqual((await server.call('companion', { session:replacement })).json.turns, []);
  } finally {
    await server.close();
  }
});

test('sessions expire after idle and absolute limits and sign-in limits return Retry-After', async () => {
  let current = Date.now();
  const server = await listen(':memory:', null, () => current);
  try {
    const first = await server.call('register', { body:registration });
    assert.match(first.headers.get('set-cookie'), /Max-Age=43200/);
    current += 29 * 60_000;
    assert.ok((await server.call('session', { session:first })).json.user);
    current += 30 * 60_000;
    assert.equal((await server.call('session', { session:first })).json.user, null);
    const second = await server.call('login', { body:registration });
    for (let i = 0; i < 24; i++) {
      current += 29 * 60_000;
      assert.ok((await server.call('session', { session:second })).json.user);
    }
    current += 24 * 60_000;
    assert.equal((await server.call('session', { session:second })).json.user, null);
    const invalid = { ...registration, password:'not valid' };
    for (let i = 0; i < 12; i++) await server.call('login', { body:invalid });
    const throttled = await server.call('login', { body:invalid });
    assert.equal(throttled.status, 429);
    assert.equal(throttled.headers.get('retry-after'), '60');
  } finally { await server.close(); }
});

test('password recovery rotates its code and invalidates existing sessions', async () => {
  const server = await listen(':memory:');
  try {
    const first = await server.call('register', { body: registration });
    const password = 'Another demo input 456';
    const recover = { email: registration.email, password, recoveryCode: first.json.recoveryCode };
    assert.equal((await server.call('login', { body: { ...registration, password } })).status, 401);
    const result = await server.call('recover', { body: recover });
    assert.equal(result.status, 200);
    assert.match(result.json.recoveryCode, /^[\w-]{32}$/);
    assert.notEqual(result.json.recoveryCode, recover.recoveryCode);
    assert.equal((await server.call('recover', { body: recover })).status, 401);
    assert.equal((await server.call('session', { session: first })).json.user, null);
    assert.equal((await server.call('login', { body: registration })).status, 401);
    assert.equal((await server.call('login', { body: { ...registration, password } })).status, 200);
  } finally {
    await server.close();
  }
});

test('AI Care checks authorizations, saves only opted-in summaries, and persists isolated conversations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lunara-care-'));
  const database = join(directory, 'care.sqlite');
  const questions = [];
  const route = async question => { questions.push(question); return 'sleep'; };
  let server = await listen(database, route);
  try {
    assert.equal((await server.call('companion')).status, 401);
    const owner = await server.call('register', { body:registration });
    assert.equal((await server.call('companion', { session:owner })).status, 403);
    assert.equal((await server.call('preferences', { session:owner, body:setup })).status, 200);
    const scoped = await server.call('companion', { session:owner });
    assert.deepEqual(scoped.json.turns, []);
    assert.equal(scoped.json.modelConfigured, true);
    const day = new Date().toISOString().slice(0, 10);
    assert.equal((await server.call('sleep', { session:owner, body:{ date:day, minutes:450, quality:'Restful' } })).status, 200);
    const body = { id:randomUUID(), revision:0, question:'How do I improve my bedtime routine?', language:'en', includeHistory:false };
    const first = await server.call('companion', { session:owner, body });
    assert.equal(first.status, 200);
    assert.equal(first.json.turns[0].reply.provider, 'ollama');
    assert.equal(first.json.turns[0].reply.context, null);
    assert.ok(first.json.turns[0].reply.sources.length);
    assert.equal((await server.call('companion', { session:owner, body })).json.turns.length, 1);
    const second = await server.call('companion', { session:owner, body:{ ...body, id:randomUUID(), includeHistory:true, language:'id' } });
    assert.equal(second.json.turns[1].historyUsed, true);
    assert.ok(second.json.turns[1].reply.context.lines.some(line => line.includes('7.5')));
    assert.deepEqual(questions, [body.question, body.question]);
    const emergency = await server.call('companion', { session:owner, body:{ ...body, id:randomUUID(), question:'Saya sedang hamil dan mengalami perdarahan', includeHistory:true, language:'id' } });
    assert.equal(emergency.json.turns[2].reply.kind, 'urgent');
    assert.equal(emergency.json.turns[2].historyUsed, false);
    assert.equal(questions.length, 2);
    const visitor = await server.call('register', { body:{ ...registration, email:'care-other@example.test' } });
    assert.equal((await server.call('preferences', { session:visitor, body:setup })).status, 200);
    assert.deepEqual((await server.call('companion', { session:visitor })).json.turns, []);
    assert.equal((await server.call('companion', { session:visitor, account:owner.account })).status, 409);
    await server.close();
    server = await listen(database, route);
    assert.equal((await server.call('companion', { session:owner })).json.turns.length, 3);
    const cleared = await server.call('companion/clear', { session:owner, body:{ revision:0 } });
    assert.deepEqual(cleared.json.turns, []);
    assert.equal(cleared.json.revision, 1);
    assert.equal((await server.call('companion', { session:owner, body:{ ...body, id:randomUUID() } })).status, 409);
  } finally {
    await server.close();
    for (const suffix of ['', '-shm', '-wal']) await rm(database + suffix, { force:true });
    await rmdir(directory);
  }
});

test('clearing a conversation invalidates a reply that is still generating', async () => {
  let entered;
  let finish;
  const started = new Promise(resolve => { entered = resolve; });
  const pendingTopic = new Promise(resolve => { finish = resolve; });
  const server = await listen(':memory:', async () => { entered(); return pendingTopic; });
  try {
    const owner = await server.call('register', { body:registration });
    await server.call('preferences', { session:owner, body:setup });
    const pending = server.call('companion', { session:owner, body:{ id:randomUUID(), revision:0, question:'What is my bedtime routine?', language:'en' } });
    await started;
    await server.call('companion/clear', { session:owner, body:{ revision:0 } });
    finish('sleep');
    assert.equal((await pending).status, 409);
    assert.deepEqual((await server.call('companion', { session:owner })).json.turns, []);
  } finally {
    finish(null);
    await server.close();
  }
});

test('report files are scoped to their account, selected dates, and explicit journal inclusion', async () => {
  const server = await listen(':memory:');
  const request = { from:'2024-02-28', to:'2024-03-02', format:'csv' };
  try {
    assert.equal((await server.call('report/export', { body:request })).status, 401);
    const owner = await server.call('register', { body:registration });
    const post = (path, body) => server.call(path, { session:owner, body });
    assert.equal((await post('report/export', request)).status, 403);
    await post('preferences', setup);
    await post('period', { start:'2024-02-26', end:'2024-02-29' });
    await post('symptom', { id:randomUUID(), date:day, time:'11:20', name:'Other', custom:'Private symptom', severity:'Moderate' });
    await post('journal', { id:randomUUID(), date:day, note:'=PRIVATE JOURNAL' });
    await post('journal', { id:randomUUID(), date:'2024-03-03', note:'Outside selected dates' });
    const csv = await post('report/export', request);
    assert.equal(csv.status, 200);
    assert.equal(csv.headers.get('cache-control'), 'no-store, private');
    assert.match(csv.headers.get('content-disposition'), /lunara-health-report-2024-02-28-to-2024-03-02.csv/);
    assert.match(csv.bytes.toString('utf8'), /"2024-02-28","2024-02-29","2","Range clipped"/);
    assert.match(csv.bytes.toString('utf8'), /Private symptom/);
    assert.doesNotMatch(csv.bytes.toString('utf8'), /2024-02-26|PRIVATE JOURNAL|Outside selected|demo@example/);
    const withNotes = await post('report/export', { ...request, includeNotes:true });
    assert.match(withNotes.bytes.toString('utf8'), /'=PRIVATE JOURNAL/);
    assert.doesNotMatch(withNotes.bytes.toString('utf8'), /Outside selected dates/);
    const pdf = await post('report/export', { ...request, format:'pdf', includeNotes:true });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.match(pdf.bytes.subarray(0, 10).toString(), /^%PDF-/);
    assert.equal((await post('report/export', { ...request, from:'2024-02-31' })).status, 400);
    assert.equal((await post('report/export', { ...request, includeNotes:'true' })).status, 400);
    const other = await server.call('register', { body:{ ...registration, email:'different-report@example.test' } });
    await server.call('preferences', { session:other, body:setup });
    const isolated = await server.call('report/export', { session:other, body:{ ...request, includeNotes:true } });
    assert.doesNotMatch(isolated.bytes.toString(), /Private|2024-02-29/);
    assert.equal((await server.call('report/export', { session:other, account:owner.account, body:request })).status, 409);
  } finally {
    await server.close();
  }
});
