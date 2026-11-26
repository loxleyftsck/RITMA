const dayMs = 86_400_000;

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return time / dayMs;
}

export function defaultReportRange(today) {
  const day = dayNumber(today);
  return { from: new Date((day - 89) * dayMs).toISOString().slice(0, 10), to: today, includeNotes:false };
}

export function reportRangeError({ from, to }, today) {
  const first = dayNumber(from);
  const last = dayNumber(to);
  if (first === null || last === null || from < '1900-01-01') return 'Choose valid start and end dates.';
  if (first > last) return 'The start date must come on or before the end date.';
  if (to > today) return 'The end date must be today or earlier.';
  if (last - first >= 366) return 'Choose a range of 366 days or fewer.';
  return '';
}

const round = value => Math.round(value * 10) / 10;
const average = values => values.length ? round(values.reduce((sum, item) => sum + item, 0) / values.length) : null;

function groupCount(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
}

function rangeEntry(entry, from, to) {
  const startOnly = entry.source === 'start-only' || (entry.source === 'legacy' && entry.start === entry.end);
  const end = entry.end ?? entry.start;
  if (entry.start > to || end < from) return null;
  if (startOnly || !entry.end) {
    return { start:entry.start, end:null, recordedDays:1, status:startOnly ? 'Start recorded' : 'End date open' };
  }
  const startInRange = entry.start < from ? from : entry.start;
  const endInRange = end > to ? to : end;
  return {
    start:startInRange,
    end:endInRange,
    recordedDays:dayNumber(endInRange) - dayNumber(startInRange) + 1,
    status:startInRange !== entry.start || endInRange !== end ? 'Range clipped' : 'Recorded',
  };
}

function observedInterval(entry, from, to) {
  return entry.from >= from && entry.to <= to;
}

export function buildReport(records, filter) {
  const { from, to, includeNotes } = filter;
  const inRange = row => row.date >= from && row.date <= to;
  const periods = records.cycles.map(entry => rangeEntry(entry, from, to)).filter(Boolean).sort((a,b) => a.start.localeCompare(b.start));
  const moods = records.moods.filter(inRange).sort((a,b) => a.date.localeCompare(b.date));
  const symptoms = records.symptoms.filter(inRange).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const sleep = records.sleep.filter(inRange).sort((a,b) => a.date.localeCompare(b.date));
  const notes = includeNotes ? records.journal.filter(inRange).sort((a,b) => a.date.localeCompare(b.date)) : [];
  const intervals = (records.analysis?.cycle.intervals ?? []).filter(entry => observedInterval(entry, from, to));
  const moodScores = key => moods.map(entry => entry[key]).filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  const energy = moodScores('energy');
  const stress = moodScores('stress');
  return {
    from, to, includeNotes, periods, moods, symptoms, sleep, notes, intervals,
    summary: {
      recordedDays: periods.reduce((sum,row) => sum + row.recordedDays, 0),
      moodCounts: groupCount(moods.map(entry => entry.mood)),
      symptomDays: new Set(symptoms.map(entry => entry.date)).size,
      energyCount:energy.length,
      stressCount:stress.length,
      averageEnergy:average(energy),
      averageStress:average(stress),
      averageSleepHours:average(sleep.map(entry => entry.minutes / 60)),
    },
  };
}

export function reportFileName(report, format) {
  return `lunara-health-report-${report.from}-to-${report.to}.${format}`;
}

export function reportSections(report) {
  const safe = value => value === null || value === undefined ? '' : String(value);
  return [
    { title:'Period records', headers:['Start shown','End shown','Days shown','Status'], widths:[.25,.25,.17,.33],
      rows:report.periods.map(row => [row.start, safe(row.end), String(row.recordedDays), row.status]) },
    { title:'Intervals between saved starts', headers:['From','To','Days'], widths:[.40,.40,.20],
      rows:report.intervals.map(row => [row.from,row.to,String(row.days)]) },
    { title:'Mood, energy and stress', headers:['Date','Mood','Energy / 5','Stress / 5'], widths:[.30,.32,.19,.19],
      rows:report.moods.map(row => [row.date,row.mood,safe(row.energy),safe(row.stress)]) },
    { title:'Symptom timeline', headers:['Date','Time','Symptom','Severity'], widths:[.25,.14,.42,.19],
      rows:report.symptoms.map(row => [row.date,row.time,row.name,row.severity]) },
    { title:'Sleep records', headers:['Date','Duration (minutes)','Quality'], widths:[.32,.36,.32],
      rows:report.sleep.map(row => [row.date,String(row.minutes),row.quality]) },
    ...(report.includeNotes ? [{ title:'Personal journal notes', headers:['Date','Note'], widths:[.25,.75],
      rows:report.notes.map(row => [row.date,row.note]) }] : []),
  ];
}
