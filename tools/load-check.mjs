import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { appServer } from '../server.mjs';
import { encryptedConnection, inspectEncrypted } from '../backend/storage.mjs';

const clients = 12;
const [mode, ...extraArgs] = process.argv.slice(2);
if (extraArgs.length || (mode && mode !== '--paced')) {
  throw new Error('Usage: node tools/load-check.mjs [--paced]');
}
const rounds = mode ? 12 : 8;
const intervalMs = mode ? 2500 : 0;
const date = new Date();
const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map(value => String(value).padStart(2, '0')).join('-');
const password = 'Synthetic RITMA load input';
const directory = await mkdtemp(join(tmpdir(), 'ritma-load-'));
const database = join(directory, 'load.sqlite');
const key = randomBytes(32);
const measures = new Map();
let origin;
let server;
const enteredCareRouter = Promise.withResolvers();
const releaseCareRouter = Promise.withResolvers();

async function call(path, { json, session, timing, status = 200 } = {}) {
  const headers = {};
  if (session) Object.assign(headers, { Cookie:session.cookie, 'X-Lunara-Account':session.id });
  if (json !== undefined) Object.assign(headers, { Origin:origin, 'Content-Type':'application/json' });
  const start = performance.now();
  const response = await fetch(origin + path, {
    method:json === undefined ? 'GET' : 'POST', headers,
    body:json === undefined ? undefined : JSON.stringify(json), signal:AbortSignal.timeout(15_000),
  });
  const body = Buffer.from(await response.arrayBuffer());
  if (timing) {
    if (!measures.has(timing)) measures.set(timing, []);
    measures.get(timing).push(performance.now() - start);
  }
  assert.equal(response.status, status, path);
  return { response, body };
}

function statistics(values) {
  values.sort((a, b) => a - b);
  const percentile = fraction => Number(values[Math.ceil(values.length * fraction) - 1].toFixed(1));
  return { n:values.length, medianMs:percentile(0.5), p95Ms:percentile(0.95), maxMs:percentile(1) };
}

try {
  server = appServer({
    database, databaseKey:key,
    careRouter:async () => {
      enteredCareRouter.resolve();
      await releaseCareRouter.promise;
      return 'sleep';
    },
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  origin = `http://127.0.0.1:${server.address().port}`;
  const marker = 'RITMA-LOAD-' + randomUUID();
  const sessions = [];
  for (let i = 0; i < clients; i++) {
    const name = 'Load test ' + (i + 1);
    const email = `ritma-load-${i + 1}@example.test`;
    const { response, body } = await call('/api/register', { status:201, json:{ email,name,password } });
    const session = { id:JSON.parse(body).user.id, cookie:response.headers.get('set-cookie').split(';')[0], marker:`${marker}[${i}]` };
    await call('/api/preferences', { session, json:{ name, tracking:'both', complete:true, consent:true } });
    sessions.push(session);
  }
  const started = performance.now();
  for (let round = 1; round <= rounds; round++) {
    const wait = started + (round - 1) * intervalMs - performance.now();
    if (wait > 0) await delay(wait);
    await Promise.all(sessions.map(async session => {
      const note = `${session.marker} log ${round}`;
      await call('/healthz', { timing:'readiness' });
      const entry = await call('/api/journal', { timing:'journal write', session, json:{ date:day, id:randomUUID(), note } });
      const saved = JSON.parse(entry.body).journal;
      assert.equal(saved.length, round);
      assert.ok(saved.every(item => item.note.startsWith(session.marker)));
      const snapshot = await call('/api/session', { timing:'session snapshot', session });
      assert.equal(snapshot.response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(JSON.parse(snapshot.body).journal, saved);
      const format = round % 2 === 0 ? 'pdf' : 'csv';
      const exportFile = await call('/api/report/export', {
        timing:`${format} export`, session, json:{ from:day, to:day, format, includeNotes:true },
      });
      assert.match(exportFile.response.headers.get('cache-control'), /no-store/);
      if (format === 'pdf') assert.equal(exportFile.body.subarray(0, 5).toString(), '%PDF-');
      else {
        const report = exportFile.body.toString();
        assert.ok(report.includes(note));
        assert.ok(sessions.every(peer => peer.id === session.id || !report.includes(peer.marker)));
      }
    }));
  }
  const elapsed = performance.now() - started;
  const operations = [...measures.values()].reduce((total, samples) => total + samples.length, 0);
  assert.equal(operations, clients * rounds * 4);
  const careResponse = call('/api/companion', {
    session:sessions[0], json:{ id:randomUUID(), revision:0, language:'en', question:'How do sleep logs work?' },
  });
  await Promise.race([
    enteredCareRouter.promise,
    careResponse.then(() => { throw new Error('The AI route completed before its controlled pause.'); }),
  ]);
  const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  releaseCareRouter.resolve();
  const [{ body }] = await Promise.all([careResponse, closed]);
  assert.equal(JSON.parse(body).turns.at(-1).reply.topic, 'sleep');
  assert.equal(inspectEncrypted(database, key), 4);
  const confirmed = encryptedConnection(database, key, { readonly:true, fileMustExist:true });
  try {
    assert.equal(confirmed.prepare('SELECT count(*) AS total FROM journal_logs').get().total, clients * rounds);
    assert.equal(confirmed.prepare('SELECT count(*) AS total FROM ai_turns').get().total, 1);
    assert.deepEqual(confirmed.pragma('foreign_key_check'), []);
  } finally {
    confirmed.close();
  }
  console.log(JSON.stringify({
    profile:mode ? 'paced' : 'burst', users:clients, rounds, intervalMs, operations, mixedSeconds:Number((elapsed / 1000).toFixed(2)),
    operationsPerSecond:Number((operations * 1000 / elapsed).toFixed(1)),
    timings:Object.fromEntries([...measures].map(([name, values]) => [name, statistics(values)])),
    isolatedCsvExports:clients * Math.ceil(rounds / 2), savedJournalEntries:clients * rounds,
    inFlightRequestCompletedDuringClose:true,
    database:'encrypted schema 4; quick_check passed',
  }, null, 2));
} finally {
  releaseCareRouter.resolve();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const suffix of ['', '-shm', '-wal', '-journal']) await rm(database + suffix, { force:true });
  await rmdir(directory);
}
