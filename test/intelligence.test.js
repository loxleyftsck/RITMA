import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { analyzeHistory } from '../backend/cycle-intelligence.mjs';
import { openDatabase } from '../backend/db.mjs';

const periods = [
  { start: '2024-01-01', end: '2024-01-04', source: 'range' },
  { start: '2024-01-28', end: '2024-02-01', source: 'range' },
  { start: '2024-02-29', end: '2024-03-03', source: 'range' },
  { start: '2024-03-30', end: '2024-04-02', source: 'range' },
];

test('forecast uses recorded intervals across leap day, independent of declared cycle length', () => {
  const analysis = analyzeHistory({ cycles: [...periods].reverse(), user: { cycleLength: 22 } }, '2024-04-10');
  assert.deepEqual(analysis.cycle.intervals.map(entry => entry.days), [27, 32, 30]);
  assert.equal(analysis.cycle.medianDays, 30);
  assert.equal(analysis.cycle.medianPeriodDays, 4);
  assert.deepEqual(analysis.cycle.next, { status: 'estimated', date: '2024-04-29', from: '2024-04-26', to: '2024-05-01', intervalsUsed: 3 });
  assert.equal(analysis.cycle.phaseToday, 'undetermined');
  assert.equal(analyzeHistory({ cycles: periods }, '2024-04-28').cycle.phaseToday, 'estimated-menstrual-start');
  assert.equal(analyzeHistory({ cycles: periods }, '2024-04-02').cycle.phaseToday, 'recorded-menstrual-day');
  assert.equal(analyzeHistory({ cycles: periods }, '2024-05-02').cycle.next.status, 'expired-window');
});

test('history with missing, open, inconsistent, highly variable and long intervals avoids unjustified estimates', () => {
  assert.deepEqual(analyzeHistory({}, '2024-04-10').cycle.next, { status: 'insufficient-history' });
  assert.equal(analyzeHistory({ cycles: periods.slice(0, 3) }, '2024-04-10').cycle.next.status, 'insufficient-history');
  const open = [...periods.slice(0, 3), { start: '2024-03-30', end: null }];
  assert.equal(analyzeHistory({ cycles: open }, '2024-04-01').cycle.next.status, 'open-period');
  assert.equal(analyzeHistory({ cycles: open }, '2024-04-01').cycle.phaseToday, 'undetermined');
  assert.equal(analyzeHistory({ cycles: open }, '2024-03-30').cycle.phaseToday, 'recorded-menstrual-day');
  const broken = [...periods, { start: '2024-02-30', end: '2024-03-04' }];
  assert.equal(analyzeHistory({ cycles: broken }, '2024-04-10').cycle.next.status, 'review-history');
  const overlap = [{ ...periods[0], end: '2024-01-28' }, ...periods.slice(1)];
  assert.equal(analyzeHistory({ cycles: overlap }, '2024-04-10').cycle.next.status, 'review-history');
  const irregular = [...periods.slice(0, 3), { start: '2024-04-29', end: '2024-05-03' }];
  assert.equal(analyzeHistory({ cycles: irregular }, '2024-05-04').cycle.next.status, 'variable-history');
  const distant = ['2023-01-01','2023-04-11','2023-07-20','2023-10-28'].map(day => ({ start: day, end: day }));
  assert.equal(analyzeHistory({ cycles: distant }, '2023-11-01').cycle.next.status, 'outside-horizon');
});

test('consistent records retain a planning range and use seven recent intervals', () => {
  const cycles = Array.from({ length: 10 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i * 31)).toISOString().slice(0, 10);
    return { start: date, end: date, source: 'range' };
  });
  const summary = analyzeHistory({ cycles: [...cycles, cycles[0]] }, '2024-10-18').cycle;
  assert.equal(summary.loggedPeriods, 10);
  assert.equal(summary.intervals.length, 9);
  assert.equal(summary.medianDays, 31);
  assert.equal(summary.next.intervalsUsed, 7);
  assert.deepEqual([summary.next.from, summary.next.date, summary.next.to], ['2024-11-04','2024-11-06','2024-11-08']);
});

test('start-only and ambiguous legacy records contribute starts without inventing period length', () => {
  const cycles = [
    { start:'2024-02-01', end:'2024-02-01', source:'legacy' },
    { start:'2024-03-01', end:'2024-03-01', source:'start-only' },
  ];
  let cycle = analyzeHistory({ cycles }, '2024-03-05').cycle;
  assert.equal(cycle.medianDays, 29);
  assert.equal(cycle.medianPeriodDays, null);
  cycle = analyzeHistory({ cycles: [...cycles, { start:'2024-04-01', end:'2024-04-01', source:'range' }] }, '2024-04-05').cycle;
  assert.equal(cycle.medianPeriodDays, 1);
});

test('wellness uses valid values and distinct days in its inclusive trailing window', () => {
  const asOf = '2024-04-29';
  const moods = [
    { date:'2024-03-30', mood:'Low', energy:1, stress:5 },
    { date:'2024-03-31', mood:'Calm', energy:4, stress:null },
    { date:'2024-04-29', mood:'Calm', energy:null, stress:2 },
    { date:'2024-04-30', mood:'Tired', energy:2, stress:5 },
  ];
  const symptoms = ['cramps','Cramps'].map(name => ({ date:'2024-04-12', name }));
  symptoms.push({ date:'2024-04-25', name:'Cramps' });
  const sleep = [{ date:'2024-04-28', minutes:420 }, { date:'2024-04-29', minutes:480 }, { date:'2024-04-29', minutes:null }];
  const { wellness } = analyzeHistory({ moods, symptoms, sleep }, asOf);
  assert.equal(wellness.from, '2024-03-31');
  assert.equal(wellness.through, asOf);
  assert.equal(wellness.moodDays, 2);
  assert.deepEqual(wellness.moodCounts, [{ name:'Calm', count:2, days:2 }]);
  assert.deepEqual(wellness.symptomCounts, [{ name:'Cramps', count:3, days:2 }]);
  assert.deepEqual(wellness.energy, { count:1, average:4 });
  assert.deepEqual(wellness.stress, { count:1, average:2 });
  assert.deepEqual(wellness.sleepMinutes, { count:2, average:450 });
});

test('schema upgrade preserves previously saved rows and associates legacy provenance', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lunara-migration-'));
  const file = join(folder, 'legacy.sqlite');
  try {
    const prior = new DatabaseSync(file);
    prior.exec("CREATE TABLE users(id TEXT PRIMARY KEY,consent_at TEXT); CREATE TABLE sessions(token TEXT PRIMARY KEY,expires INTEGER); CREATE TABLE cycles(user_id TEXT,start_date TEXT,end_date TEXT); INSERT INTO cycles VALUES('sample','2024-01-01','2024-01-01'); PRAGMA user_version=1;");
    prior.close();
    const migrated = openDatabase(file);
    try {
      assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 4);
      assert.equal(migrated.prepare("SELECT source FROM cycles WHERE user_id='sample'").get().source, 'legacy');
    } finally {
      migrated.close();
    }
  } finally {
    for (const suffix of ['', '-shm', '-wal']) await rm(file + suffix, { force:true });
    await rmdir(folder);
  }
});
