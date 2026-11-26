const DAY = 86_400_000;
const HISTORY_SIZE = 7;
const MIN_INTERVALS = 3;
const MAX_SPREAD = 14;
const MAX_HORIZON = 90;
const MIN_PADDING = 2;
const WELLNESS_DAYS = 30;

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp / DAY;
}

const dateAt = day => new Date(day * DAY).toISOString().slice(0, 10);

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeCycles(cycles, today) {
  const unique = new Map();
  let needsReview = false;
  for (const range of cycles) {
    const start = dayNumber(range?.start);
    const end = dayNumber(range?.end);
    const open = range?.end == null;
    if (start === null || start > today || (!open && (end === null || end < start || end > today))) {
      needsReview = true;
      continue;
    }
    const hasDuration = end !== null && range.source !== 'start-only' && (range.source !== 'legacy' || start !== end);
    if (unique.has(start)) {
      if (unique.get(start).end !== end || unique.get(start).hasDuration !== hasDuration) needsReview = true;
      continue;
    }
    unique.set(start, { start, end, hasDuration });
  }
  return { records: [...unique.values()].sort((a, b) => a.start - b.start), needsReview };
}

function observedIntervals(records) {
  const intervals = [];
  let interrupted = false;
  for (let i = 1; i < records.length; i++) {
    const previous = records[i - 1];
    const current = records[i];
    if (previous.end === null || previous.end >= current.start) {
      interrupted = true;
      continue;
    }
    intervals.push({ from: dateAt(previous.start), to: dateAt(current.start), days: current.start - previous.start });
  }
  return { intervals, interrupted };
}

function estimate(recent, latest, today, needsReview) {
  const none = status => ({ status });
  if (needsReview) return none('review-history');
  if (latest?.end === null) return none('open-period');
  if (recent.length < MIN_INTERVALS) return none('insufficient-history');
  const values = recent.map(entry => entry.days);
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (high - low > MAX_SPREAD) return none('variable-history');
  const middle = Math.round(median(values));
  const from = latest.start + Math.max(1, Math.min(low, middle - MIN_PADDING));
  const to = latest.start + Math.max(high, middle + MIN_PADDING);
  if (to - latest.start > MAX_HORIZON) return none('outside-horizon');
  if (from <= latest.end) return none('review-history');
  if (today > to) return none('expired-window');
  return {
    status: 'estimated',
    date: dateAt(latest.start + middle),
    from: dateAt(from),
    to: dateAt(to),
    intervalsUsed: recent.length,
  };
}

function groupLogs(records, key, day) {
  const groups = new Map();
  for (const record of records) {
    const id = key(record);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, { name: id, count: 0, dates: new Set() });
    const group = groups.get(id);
    group.count++;
    group.dates.add(day(record));
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'))
    .map(group => ({ name: group.name, count: group.count, days: group.dates.size }));
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function metric(values) {
  return { count: values.length, average: average(values) };
}

function wellnessSummary({ moods, symptoms, sleep }, today) {
  const first = today - (WELLNESS_DAYS - 1);
  const withinWindow = record => {
    const day = dayNumber(record?.date);
    return day !== null && day >= first && day <= today;
  };
  const recentMoods = moods.filter(withinWindow);
  const recentSymptoms = symptoms.filter(withinWindow);
  const recentSleep = sleep.filter(withinWindow);
  const scores = key => recentMoods.map(record => record[key]).filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  const symptomGroups = groupLogs(recentSymptoms, record => {
    return typeof record.name === 'string' ? record.name.trim().toLocaleLowerCase('en') : null;
  }, record => record.date);
  const displayNames = new Map(recentSymptoms.filter(record => typeof record.name === 'string')
    .map(record => [record.name.trim().toLocaleLowerCase('en'), record.name.trim()]));
  return {
    from: dateAt(first),
    through: dateAt(today),
    moodDays: new Set(recentMoods.map(record => record.date)).size,
    moodCounts: groupLogs(recentMoods, record => record.mood, record => record.date),
    symptomCount: recentSymptoms.length,
    symptomDays: new Set(recentSymptoms.map(record => record.date)).size,
    symptomCounts: symptomGroups.map(group => ({ ...group, name: displayNames.get(group.name) })),
    energy: metric(scores('energy')),
    stress: metric(scores('stress')),
    sleepMinutes: metric(recentSleep.map(record => record.minutes).filter(value => Number.isInteger(value) && value >= 0 && value <= 1440)),
  };
}

export function analyzeHistory({ cycles = [], moods = [], symptoms = [], sleep = [] }, asOf) {
  const today = dayNumber(asOf);
  if (today === null) throw new TypeError('Provide a valid local calendar date');
  const { records, needsReview } = normalizeCycles(cycles, today);
  const { intervals, interrupted } = observedIntervals(records);
  const latest = records.at(-1);
  const recent = intervals.slice(-HISTORY_SIZE);
  const closed = records.filter(record => record.hasDuration);
  const next = estimate(recent, latest, today, needsReview || interrupted);
  const recorded = closed.some(record => record.start <= today && today <= record.end) || latest?.start === today;
  const estimated = next.status === 'estimated' && next.from <= asOf && asOf <= next.to;
  return {
    asOf,
    cycle: {
      loggedPeriods: records.length,
      closedPeriods: closed.length,
      latestStart: latest ? dateAt(latest.start) : null,
      openPeriod: Boolean(latest && latest.end === null),
      intervals,
      medianDays: median(intervals.map(entry => entry.days)),
      medianPeriodDays: median(closed.map(entry => entry.end - entry.start + 1)),
      phaseToday: recorded ? 'recorded-menstrual-day' : estimated ? 'estimated-menstrual-start' : 'undetermined',
      next,
    },
    wellness: wellnessSummary({ moods, symptoms, sleep }, today),
  };
}
