import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReport, defaultReportRange, reportRangeError, reportSections } from '../src/report-data.js';
import { createReportCsv, createReportPdf } from '../backend/report-export.mjs';
import { articles, categories, findArticles } from '../src/wellness-data.js';

const range = { from:'2024-02-28', to:'2024-03-02', includeNotes:false };
const source = {
  cycles:[
    { start:'2024-02-24', end:'2024-02-29', source:'range' },
    { start:'2024-03-01', end:null, source:'range' },
  ],
  moods:[{ date:'2024-02-29', mood:'Calm', energy:4, stress:null }],
  symptoms:[{ date:'2024-03-01', time:'10:00', name:'Example', severity:'Mild' }],
  sleep:[{ date:'2024-03-01', minutes:450, quality:'Restful' }],
  journal:[{ date:'2024-02-29', note:'=1+1 é' }, { date:'2024-03-03', note:'outside' }],
  analysis:{ cycle:{ intervals:[{ from:'2024-02-24', to:'2024-03-01', days:6 }] } },
};

test('report selection uses inclusive ISO dates and counts only the selected portions', () => {
  assert.deepEqual(defaultReportRange('2024-03-01'), { from:'2023-12-03', to:'2024-03-01', includeNotes:false });
  assert.equal(reportRangeError(range, '2024-03-02'), '');
  assert.equal(reportRangeError({ from:'2024-01-01', to:'2024-12-31' }, '2024-12-31'), '');
  assert.match(reportRangeError({ from:'2023-12-31', to:'2024-12-31' }, '2024-12-31'), /366/);
  assert.match(reportRangeError(range, '2024-03-01'), /today/);
  const report = buildReport(source, range);
  assert.deepEqual(report.periods, [
    { start:'2024-02-28', end:'2024-02-29', recordedDays:2, status:'Range clipped' },
    { start:'2024-03-01', end:null, recordedDays:1, status:'End date open' },
  ]);
  assert.equal(report.summary.recordedDays, 3);
  assert.equal(report.summary.averageEnergy, 4);
  assert.equal(report.summary.averageStress, null);
  assert.equal(report.summary.averageSleepHours, 7.5);
  assert.deepEqual(report.notes, []);
  assert.deepEqual(report.intervals, []);
  assert.equal(reportSections(report).some(section => section.title.includes('journal')), false);
});

test('PDF buffers and CSV preserves safe Unicode and private scope', async () => {
  const data = buildReport(source, { ...range, includeNotes:true });
  const csv = createReportCsv(data).toString('utf8');
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /'=1\+1 é/);
  assert.doesNotMatch(csv, /outside/);
  const onlyNotes = buildReport({ ...source, cycles:[], moods:[], symptoms:[], sleep:[] }, { ...range, includeNotes:true });
  const pdf = (await createReportPdf(onlyNotes)).toString('latin1');
  assert.match(pdf, /^%PDF-/);
  assert.equal([...pdf.matchAll(/\/Type\s*\/Page\b/g)].length, 1);
});

test('Wellness articles use distinct deep links, official references, and combined category search', () => {
  assert.equal(new Set(articles.map(item => item.id)).size, articles.length);
  assert.equal(categories.length, 9);
  assert.ok(articles.every(article => article.sections.length >= 2 && article.sources.every(([,url]) => url.startsWith('https://'))));
  assert.deepEqual(findArticles('Hormones', 'estrogen').map(item => item.id), ['hormones-and-cycle']);
  assert.equal(findArticles('Sleep', 'estrogen').length, 0);
});
