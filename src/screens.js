import { button, empty, escapeHtml, field, heading, icon, link } from './components.js';
import { buildReport, defaultReportRange, reportSections } from './report-data.js';
import { articles, categories, findArticles } from './wellness-data.js';

export const primaryNav = [
  ['home', 'Home', 'home'], ['cycle', 'Cycle', 'cycle'], ['insights', 'Insights', 'insights'],
  ['companion', 'AI Care', 'care'], ['profile', 'Profile', 'user'],
];
export const routes = new Set(['welcome', 'login', 'register', 'recovery', 'onboarding', 'home', 'cycle', 'cycle-details', 'mood', 'symptoms', 'sleep', 'insights', 'companion', 'report', 'wellness', 'profile', 'settings', 'privacy']);
export const phases = [
  ['menstrual', 'Menstrual', 'Period days and cycle history.'],
  ['follicular', 'Follicular', 'The phase leading up to ovulation.'],
  ['ovulatory', 'Ovulatory', 'A phase that may occur around ovulation.'],
  ['luteal', 'Luteal', 'The phase after ovulation, when it occurs.'],
];
export const moods = ['Radiant', 'Calm', 'Tender', 'Tired', 'Low'];
export const symptoms = ['Cramps', 'Headache', 'Bloating', 'Acne', 'Fatigue', 'Other'];
const steps = [
  ['cycle-awareness', 'Meet your rhythm.', 'See your logs in one place and learn the language of your cycle.'],
  ['emotional-wellness', 'Make room for how you feel.', 'Check in when it feels helpful and notice what changes over time.'],
  ['personal-insights', 'Reflect on your own patterns.', 'Explore the information you choose to share with yourself.'],
  ['self-care', 'Move at your own pace.', 'Choose what to track, and come back whenever you’re ready.'],
];

export function routeFromHash(hash) {
  const [, candidate = '', query = ''] = /^#\/([^?]+)(?:\?(.*))?$/.exec(hash) ?? [];
  return { name: routes.has(candidate) ? candidate : 'welcome', query: new URLSearchParams(query) };
}

export function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const blanks = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array(blanks).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
}

export function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, '0')).join('-');
}

const dateLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const metricNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const formatDate = (day, format = dateLabel) => format.format(new Date(day + 'T00:00:00Z'));
const formatMetric = value => metricNumber.format(value);
const quantity = (count, singular, plural = singular + 's') => `${count} ${count === 1 ? singular : plural}`;
const completeRange = range => range.end !== null && range.source !== 'start-only' && (range.source !== 'legacy' || range.start !== range.end);

const estimateReasons = {
  'insufficient-history': 'Save four period starts to provide at least three observed intervals.',
  'open-period': 'Add the end date of the open period before estimating the next start.',
  'variable-history': 'The recent intervals vary too much to give a useful date window.',
  'outside-horizon': 'Recent intervals exceed the estimator’s planning horizon. Review your recorded starts.',
  'review-history': 'Review the dates in your period history before estimating the next start.',
  'expired-window': 'The previous estimate window has passed. Add the next period when it occurs.',
};

function periodEstimate(analysis, detail = false) {
  const next = analysis?.cycle.next;
  if (!next || next.status !== 'estimated') {
    return `<div class="estimate"><h2>Next period estimate</h2><p>${estimateReasons[next?.status] ?? estimateReasons['insufficient-history']}</p></div>`;
  }
  return `<div class="estimate"><div class="section-top"><h2>Next period start</h2><span class="estimate-tag">Estimate</span></div>
    <p class="estimate-date"><time datetime="${next.date}">${formatDate(next.date)}</time></p>
    <p>Estimated window ${formatDate(next.from)} – ${formatDate(next.to)}</p>
    ${detail ? `<p>Based on ${next.intervalsUsed} recent intervals between logged starts. Unlogged periods can affect the estimate. Fertility and ovulation remain undetermined.</p>` : ''}
  </div>`;
}

function phaseLabel(analysis) {
  if (analysis?.cycle.phaseToday === 'recorded-menstrual-day') return 'Menstrual day recorded today';
  if (analysis?.cycle.phaseToday === 'estimated-menstrual-start') return 'Today falls in the estimated start window';
  return 'Current phase undetermined';
}

function welcome(image) {
  return `<div class="welcome"><div class="welcome-inner">
    <div class="welcome-copy">
      ${image('brand/logo-primary', { className: 'welcome-logo', eager: true })}
      <div class="welcome-message"><h1 id="page-title" tabindex="-1">Understand your body.<br>Own your rhythm.</h1>
      ${image('brand/logo-dark', { className: 'welcome-mobile-logo', eager: true })}
      <p>A space for cycle awareness, check-ins and everyday care.</p>
      <div class="actions">${link('onboarding', 'Get started', { style: 'primary', glyph: 'right' })}${link('login', 'Sign in', { style: 'secondary' })}</div></div>
    </div>
    <div class="welcome-art">${image('editorial/welcome-portrait', { eager: true })}</div>
  </div></div>`;
}

function auth(image, register) {
  const title = register ? 'Create your account' : 'Welcome back';
  return `<div class="entry"><div class="entry-art">${image('editorial/hero-fabric', { eager: true })}</div><section class="entry-copy">
    ${link('welcome', 'Back to welcome', { glyph: 'left' })}
    ${heading(title, register ? 'Create an account for this local installation.' : 'Sign in to open your saved records.')}
    <form data-form="${register ? 'register' : 'login'}" class="form-stack">
      ${register ? field('Name', 'name', 'text', 'autocomplete="name" maxlength="60" required') : ''}
      ${field('Email', 'email', 'email', 'autocomplete="username" maxlength="254" required')}
      ${field('Password', 'password', 'password', `autocomplete="${register ? 'new-password' : 'current-password'}" minlength="10" maxlength="128" required`)}
      <button class="action primary" type="submit">${register ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="actions">${register ? link('login', 'Already have an account? Sign in') : link('register', 'Create an account') + link('recovery', 'Reset password')}</div>
  </section></div>`;
}

function recovery(image) {
  return `<div class="entry"><div class="entry-art">${image('editorial/hero-fabric', { eager: true })}</div><section class="entry-copy">
    ${link('login', 'Back to sign in', { glyph: 'left' })}
    ${heading('Reset password', 'Use the recovery code from your local account.')}
    <form data-form="recover" class="form-stack">
      ${field('Email', 'email', 'email', 'autocomplete="username" maxlength="254" required')}
      ${field('Recovery code', 'recoveryCode', 'text', 'autocomplete="off" maxlength="32" required')}
      ${field('New password', 'password', 'password', 'autocomplete="new-password" minlength="10" maxlength="128" required')}
      <button class="action primary" type="submit">Reset password</button>
    </form></section></div>`;
}

function trackingFields(account) {
  const options = [['cycle','Cycle tracking'], ['wellness','Wellness check-ins'], ['both','Cycle and wellness']];
  return `<label class="field"><span>Tracking preference</span><select name="tracking">${options.map(([value,label]) => `<option value="${value}" ${account.tracking === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <div class="form-columns">
      ${field('Typical cycle length in days (optional)', 'cycleLength', 'number', `min="1" max="365" value="${account.cycleLength ?? ''}"`)}
      ${field('Typical period length in days (optional)', 'periodLength', 'number', `min="1" max="365" value="${account.periodLength ?? ''}"`)}
    </div>`;
}

function onboarding(image, state) {
  if (state.account && state.step >= steps.length) return `<div class="entry"><div class="entry-art illustration">${image('onboarding/self-care')}</div><section class="entry-copy">
    ${heading('Set up your tracking', 'Choose what you want to record. Both lengths and the period start are optional.')}
    <form data-form="setup" class="form-stack">${trackingFields(state.account)}
    ${field('Last period start (optional)', 'lastPeriod', 'date', `max="${dateKey(new Date())}"`)}
    <label class="setting"><input type="checkbox" name="consent" required><span>I agree to store the health details I enter on this device.</span></label>
    <button class="action primary" type="submit">Finish setup</button></form>
    <div class="actions">${link('privacy', 'Privacy & data')}${button('logout', 'Sign out', { style: 'text' })}</div>
  </section></div>`;
  const step = Math.min(state.step, steps.length - 1);
  const [asset, title, copy] = steps[step];
  return `<div class="entry onboarding-intro"><div class="entry-art illustration">${image('onboarding/' + asset, { eager: true })}</div><section class="entry-copy">
    ${link('welcome', 'Back', { glyph: 'left' })}
    <p class="step-label">Step ${step + 1} of ${steps.length}</p>
    ${heading(title, copy)}
    <div class="step-dots" aria-hidden="true">${steps.map((_,index) => `<span class="${index === step ? 'current' : ''}"></span>`).join('')}</div>
    <div class="actions">${button('onboard-next', 'Continue', { glyph: 'right' })}
      ${step ? button('onboard-back', 'Previous', { style: 'secondary' }) : ''}
    </div>
    ${button('onboard-skip', 'Skip introduction', { style: 'text' })}
  </section></div>`;
}

function cycleAtAGlance(image, state, today, paused) {
  const latest = state.cycles.find(range => range.start <= today);
  const day = value => Date.parse(value + 'T00:00:00Z') / 86_400_000;
  const elapsed = latest ? day(today) - day(latest.start) + 1 : null;
  const next = state.analysis?.cycle.next;
  const periodAction = !latest ? 'Log first period' : latest.end === null || latest.end >= today ? 'Edit period' : 'Log period';
  return `<section class="surface cycle-glance" aria-labelledby="today-cycle">
    <div class="section-top"><h2 id="today-cycle">Your cycle</h2>${link('cycle', 'Calendar', { glyph:'chevron' })}</div>
    <div class="cycle-dial">
      ${image('editorial/chiffon-orbit', { className:'cycle-orbit', eager:true, decorative:true })}
      <div>${elapsed ? `<span>Day</span><strong>${elapsed}</strong>` : icon('cycle')}</div>
    </div>
    ${elapsed ? `<p class="cycle-day-note">Since last logged start</p>` : ''}
    ${paused ? `<p>Tracking is paused.</p><div class="cycle-actions">${link('privacy', 'Manage tracking', { style:'secondary' })}</div>` : `
      <p>${elapsed ? phaseLabel(state.analysis) : 'Saved period starts appear here.'}</p>
      ${latest ? `<div class="cycle-estimate"><div><strong>Next period</strong><p>${next?.status === 'estimated' ? `${formatDate(next.from)} – ${formatDate(next.to)}` : (estimateReasons[next?.status] ?? estimateReasons['insufficient-history'])}</p></div>${next?.status === 'estimated' ? '<span>Estimate</span>' : ''}</div>` : ''}
      <div class="cycle-actions">${button('today-period-dialog', periodAction, { glyph:periodAction === 'Edit period' ? 'calendar' : 'plus' })}</div>`}
  </section>`;
}

function moodChoices(image, selected, disabled = false) {
  return moods.map(value => `<button type="button" class="choice" data-mood="${value}" aria-pressed="${selected === value}"${disabled ? ' disabled' : ''}><span class="choice-icon">${image('mood/' + value.toLowerCase(), { eager:true, decorative:true })}</span><span>${value}</span></button>`).join('');
}

export function moodPortrait(image, selected) {
  const mood = moods.includes(selected) ? selected : '';
  const portrait = mood ? image('mood/' + mood.toLowerCase(), { eager:true, decorative:true }) : icon('heart');
  return `<div class="mood-portrait-art">${portrait}</div><p>${mood || 'Choose a mood'}</p>`;
}

const cycleQuestion = 'What do cycle phases mean?';

function home(image, state) {
  const now = new Date();
  const today = dateKey(now);
  const displayDay = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const name = state.name ? `, ${escapeHtml(state.name)}` : '';
  const paused = state.account?.consent === false;
  const checkIn = state.moods.find(entry => entry.date === today);
  const symptomCount = state.symptoms.filter(entry => entry.date === today).length;
  const sleepEntry = state.sleep.find(entry => entry.date === today);
  return `<div class="home-heading"><p><time datetime="${today}">${displayDay}</time></p>${heading('Welcome' + name + '.')}</div>
    <div class="home-grid">
      ${cycleAtAGlance(image, state, today, paused)}
      <section class="surface check-in"><div class="section-top"><h2>Daily check-in</h2>${link('mood', paused ? 'View mood history' : 'Mood details', { glyph:'chevron' })}</div>
        <div class="choice-grid">${moodChoices(image, state.mood, paused)}</div>
        <div class="today-checkin" data-today-checkin aria-live="polite">${checkIn ? `<span>${escapeHtml(checkIn.mood)} logged</span>${checkIn.energy == null ? '' : `<span class="today-energy">Energy ${checkIn.energy}/5</span>`}${checkIn.stress == null ? '' : `<span class="today-stress">Stress ${checkIn.stress}/5</span>`}` : ''}</div>
      </section>
      <section class="today-logs" aria-label="Daily logs">
        ${todayLog(paused, 'symptoms', 'symptom-dialog', symptomCount ? 'Log another symptom' : 'Log symptom', symptomCount ? `${quantity(symptomCount, 'entry', 'entries')} today` : 'No entries today', 'plus')}
        ${todayLog(paused, 'sleep', 'sleep-dialog', sleepEntry ? 'Edit sleep' : 'Log sleep', sleepEntry ? `${Math.floor(sleepEntry.minutes / 60)} h ${sleepEntry.minutes % 60} min` : 'No entry today', 'moon')}
      </section>
      <a class="surface today-care" href="#/companion${paused ? '' : '?prompt=phase'}">${image('care/lumi', { decorative:true })}<div><h2>${paused ? 'AI Care history' : 'Ask Lumi'}</h2><p>${paused ? 'Read your previous conversations.' : cycleQuestion}</p></div>${icon('chevron')}</a>
    </div>`;
}

function todayLog(paused, href, action, label, status, glyph) {
  const content = `${icon(glyph)}<span><strong>${paused ? (href === 'sleep' ? 'Sleep history' : 'Symptom history') : label}</strong><span>${status}</span></span>`;
  return paused ? `<a class="surface today-log" href="#/${href}">${content}</a>` : `<button class="surface today-log" type="button" data-action="${action}">${content}</button>`;
}

function cycle(image, state) {
  const { year, month } = state.month;
  const title = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const today = dateKey(new Date());
  const next = state.analysis?.cycle.next;
  const hasEstimate = next?.status === 'estimated';
  const cells = monthDays(year, month).map(day => {
    if (day === null) return '<span aria-hidden="true"></span>';
    const date = dateKey(new Date(year, month, day));
    const logged = state.cycles.some(range => date === range.start || (completeRange(range) && range.start <= date && date <= range.end));
    const predicted = !logged && hasEstimate && next.from <= date && date <= next.to;
    const kind = logged ? 'logged' : predicted ? 'predicted' : '';
    const annotation = logged ? ', period logged' : predicted ? ', estimated period start window' : '';
    return `<button type="button" data-date="${date}" aria-label="${day} ${title}${annotation}" aria-pressed="${state.selectedDate === date}" ${date === today ? 'aria-current="date"' : ''} class="${kind}">${day}${logged ? '<span></span>' : ''}</button>`;
  }).join('');
  return `${heading('Cycle tracker', 'Review your history and log period days.')}
    <div class="content-grid"><section class="surface calendar">
      <div class="calendar-title"><button class="icon-button" data-action="month-back" aria-label="Previous month">${icon('chevronBack')}</button><h2>${title}</h2><button class="icon-button" data-action="month-next" aria-label="Next month">${icon('chevron')}</button></div>
      <div class="calendar-grid" role="group" aria-label="${title}"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>${cells}</div>
      <div class="calendar-key"><span><i class="today" aria-hidden="true"></i> Today</span><span><i class="logged" aria-hidden="true"></i> Logged period</span>${hasEstimate ? '<span><i class="predicted" aria-hidden="true"></i> Estimated start window</span>' : ''}</div>
      ${state.selectedDate ? `<div class="calendar-selection"><p>Selected date <strong>${state.selectedDate}</strong></p>${state.selectedDate <= today ? button('period-dialog', 'Open date log', { style: 'secondary' }) : ''}</div>` : ''}
      ${button('period-dialog', 'Log period', { glyph: 'calendar' })}
    </section>
    <div class="stack"><section class="surface prose cycle-summary">${periodEstimate(state.analysis, true)}<p class="phase-today">${phaseLabel(state.analysis)}</p></section>
    <section class="surface phase-list"><h2>Learn about cycle phases</h2>${phases.map(([slug, name]) => `<a href="#/cycle-details?phase=${slug}">${image('cycle/' + slug, { decorative: true })}<span>${name}</span>${icon('right')}</a>`).join('')}</section></div></div>
    ${state.cycles.length ? `<section class="surface history"><h2>Period history</h2><ul class="entry-list">${state.cycles.map(range => `<li class="period-row"><span><strong>${range.start}</strong> <span>${range.end === null ? 'End date open' : !completeRange(range) ? 'Start recorded' : range.end === range.start ? 'One day' : 'to ' + range.end}</span></span><button type="button" class="action secondary" data-period-start="${range.start}">Edit period</button></li>`).join('')}</ul></section>` : empty(image, 'empty-states/no-period-history', 'No periods logged', 'The periods you log appear here.')}`;
}

function cycleDetail(image, query) {
  const [slug, name, description] = phases.find(([id]) => id === query.get('phase')) ?? phases[0];
  return `${link('cycle', 'Back to cycle tracker', { glyph: 'left' })}${heading(name + ' phase', description)}
    <div class="content-grid"><section class="surface detail-image">${image('cycle/' + slug)}</section><section class="surface prose"><h2>Your observations</h2><p>Use a check-in or symptom log to record how you feel. Phase timing can vary from cycle to cycle.</p>${link('symptoms', 'Open symptom tracker', { style: 'secondary', glyph: 'right' })}</section></div>`;
}

function levelPicker(label, fieldName, current) {
  const levels = [1, 2, 3, 4, 5];
  return `<fieldset class="level-picker level-picker--${fieldName}"><legend>${label}</legend>
    <div class="level-options">${levels.map(level => {
      const endpoint = level === 1 ? ', Low' : level === 5 ? ', High' : '';
      return `<label class="level-option"><input type="radio" name="${fieldName}" value="${level}" aria-label="${level} of 5${endpoint}" ${current === level ? 'checked' : ''}><span>${level}</span></label>`;
    }).join('')}</div>
    <div class="level-caption"><span>Low</span><label class="level-option level-empty"><input type="radio" name="${fieldName}" value="" ${current == null ? 'checked' : ''}><span>Not logged</span></label><span>High</span></div>
  </fieldset>`;
}

function mood(image, state) {
  const today = dateKey(new Date());
  const current = state.moods.find(entry => entry.date === today);
  const paused = state.account?.consent === false;
  return `${heading('Mood tracker', 'Notice how today feels.')}
    <div class="content-grid"><section class="surface prose mood-card"><h2>How are you feeling today?</h2><div data-mood-hero class="mood-portrait">${moodPortrait(image, state.mood)}</div><div class="choice-grid mood-choices">${moodChoices(image, state.mood, paused)}</div>
    ${paused ? `<p class="analysis-note">Tracking is paused. You can still review your saved history.</p>${link('privacy','Manage tracking consent',{ glyph:'right' })}`
    : `<form class="form-stack mood-details" data-form="checkin">
    ${levelPicker('Energy', 'energy', current?.energy)}
    ${levelPicker('Stress', 'stress', current?.stress)}
    <button class="action primary" type="submit">Save check-in</button></form>
    <form class="form-stack" data-form="journal"><label class="field"><span>Journal entry</span><textarea name="entry" rows="4" maxlength="500" required placeholder="What’s on your mind?"></textarea></label><button class="action primary" type="submit">Save entry</button></form>`}</section>
    <div class="stack">${state.moods.length ? `<section class="surface prose"><h2>Check-in history</h2><ul class="entry-list">${state.moods.map(entry => `<li><strong>${entry.date}</strong> <span>${entry.mood}</span>${entry.energy === null ? '' : ` <span>Energy ${entry.energy}/5</span>`}${entry.stress === null ? '' : ` <span>Stress ${entry.stress}/5</span>`}</li>`).join('')}</ul></section>` : ''}
    ${state.journal.length ? `<section class="surface prose"><h2>Journal entries</h2><ul class="entry-list">${state.journal.map(entry => `<li>${escapeHtml(entry.note)} <time>${entry.date}</time></li>`).join('')}</ul></section>` : empty(image, 'empty-states/no-journal', 'No journal entries', 'Write a few words about your day when you feel ready.')}</div></div>`;
}

function symptomScreen(image, state) {
  return `${heading('Symptom tracker', 'Keep track of how you feel physically.', button('symptom-dialog', 'Log a symptom', { glyph: 'plus' }))}
    ${state.symptoms.length ? `<section class="surface prose"><h2>Recent entries</h2><ul class="entry-list">${state.symptoms.map(entry => `<li><strong>${escapeHtml(entry.name)}</strong> <span>${escapeHtml(entry.severity)}</span> <time>${entry.date} ${entry.time}</time></li>`).join('')}</ul></section>` : empty(image, 'empty-states/no-symptoms', 'No symptoms logged', 'The symptoms you record appear here.')}`;
}

function sleep(image, state) {
  return `${heading('Sleep tracker', 'Record how long you slept and how it felt.', button('sleep-dialog', 'Log sleep', { glyph: 'plus' }))}
    <div class="content-grid"><section class="surface prose"><h2>Sleep history</h2>
    ${state.sleep.length ? `<ul class="entry-list">${state.sleep.map(entry => `<li><strong>${entry.date}</strong> <span>${Math.floor(entry.minutes / 60)} h ${entry.minutes % 60} min</span> <span>${entry.quality}</span></li>`).join('')}</ul>` : '<p>No sleep entries yet.</p>'}</section>
    <section class="surface detail-image">${image('wellness/sleep-recovery', { decorative: true })}</section></div>`;
}

function historyChart(cycle) {
  const values = cycle.intervals.slice(-7);
  const scale = Math.max(...values.map(entry => entry.days), 1);
  return `<section class="surface sample-chart"><div class="section-top"><h2>Time between logged starts</h2><span>Observed history</span></div>
    ${values.length ? `<ol class="chart" aria-label="Recent intervals between period starts">${values.map(entry => `<li style="--bar:${entry.days / scale * 100}%"><strong>${entry.days} days</strong><span aria-hidden="true"></span><small>${formatDate(entry.to, shortDate)}</small></li>`).join('')}</ol>` : '<p>Log at least two period starts to see the time between them.</p>'}
    <dl class="summary-list chart-summary"><div><dt>Median interval</dt><dd>${cycle.medianDays === null ? '—' : formatMetric(cycle.medianDays) + ' days'}</dd></div>
    <div><dt>Median recorded period length</dt><dd>${cycle.medianPeriodDays === null ? '—' : formatMetric(cycle.medianPeriodDays) + ' days'}</dd></div></dl>
    ${values.length ? `<details><summary>View dates and lengths</summary><ul class="entry-list">${cycle.intervals.toReversed().map(entry => `<li>${formatDate(entry.from)} – ${formatDate(entry.to)} <strong>${entry.days} days</strong></li>`).join('')}</ul></details>` : ''}
    <p class="analysis-note">The interval uses logged start dates. Missing entries may lengthen an interval. Period length uses records with a confirmed end date.</p>
  </section>`;
}

function wellnessCards(wellness) {
  const score = stat => stat.average === null ? '—' : `${formatMetric(stat.average)}/5 (${quantity(stat.count, 'entry', 'entries')})`;
  const symptomText = (count, days) => `${quantity(count, 'entry', 'entries')} across ${quantity(days, 'day')}`;
  const counts = (groups, suffix) => groups.length ? `<ul class="entry-list">${groups.map(group => `<li><strong>${escapeHtml(group.name)}</strong> <span>${suffix(group)}</span></li>`).join('')}</ul>` : '';
  return `<div class="analysis-heading"><h2>Wellness in the last 30 days</h2><p>${formatDate(wellness.from)} – ${formatDate(wellness.through)}</p></div>
    <div class="wellness-grid"><section class="surface prose"><h2>Mood and check-ins</h2>
      <p>${quantity(wellness.moodDays, 'day')} with a mood check-in</p>${counts(wellness.moodCounts, group => quantity(group.days, 'day'))}
      <dl class="summary-list"><div><dt>Average energy</dt><dd>${score(wellness.energy)}</dd></div><div><dt>Average stress</dt><dd>${score(wellness.stress)}</dd></div></dl></section>
    <section class="surface prose"><h2>Symptoms logged</h2><p>${symptomText(wellness.symptomCount, wellness.symptomDays)}</p>
      ${counts(wellness.symptomCounts, group => symptomText(group.count, group.days))}${link('symptoms', 'View symptom tracker', { glyph: 'right' })}</section>
    <section class="surface prose"><h2>Sleep logged</h2><p>${wellness.sleepMinutes.count ? `Average ${formatMetric(wellness.sleepMinutes.average / 60)} h across ${quantity(wellness.sleepMinutes.count, 'logged night')}.` : 'No sleep entries in this window.'}</p>
      ${link('sleep', 'View sleep tracker', { glyph: 'right' })}</section></div>
    <p class="analysis-note">Summaries use saved entries only. A day without an entry has no recorded value.</p>`;
}

function insights(image, state) {
  const analysis = state.analysis;
  const title = heading('Insights', 'Review timing and wellness patterns in your recorded history.');
  if (!analysis || !(analysis.cycle.loggedPeriods || analysis.wellness.moodDays || analysis.wellness.symptomCount || analysis.wellness.sleepMinutes.count)) {
    return title + empty(image, 'empty-states/no-insights', 'No personal insights yet', 'Log a period or a wellness check-in to see your real history here.', link('cycle', 'Open cycle tracker', { style: 'secondary', glyph: 'right' }));
  }
  return `${title}${historyChart(analysis.cycle)}${wellnessCards(analysis.wellness)}`;
}

export const carePrompts = [
  ['Cycle timing', 'How do I count time between period starts?'],
  ['Understand estimates', 'How do period estimates work?'],
  ['My saved records', 'Can you summarize my saved records?'],
  ['Prepare for a visit', 'How can I prepare for a doctor visit?'],
];

function careTurn(turn, last, emblem) {
  const { reply } = turn;
  const label = { urgent:'Seek care now', boundary:'Talk with a healthcare professional', education:'Lumi' }[reply.kind];
  const sourceList = reply.sources.length ? `<details class="care-citations"><summary>Sources (${reply.sources.length})</summary><ul class="care-sources">${reply.sources.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></details>` : '';
  return `<li class="care-turn"><div class="care-question"><p><span class="skip-text">You: </span>${escapeHtml(turn.question)}</p></div>
    <div class="care-reply">${emblem}<article class="care-answer ${reply.kind === 'urgent' ? 'care-urgent' : ''}" ${last ? 'id="latest-answer" tabindex="-1"' : ''}>
      <h3>${label}</h3>${reply.paragraphs.map(text => `<p lang="${turn.language === 'id' ? 'id' : 'en'}">${escapeHtml(text)}</p>`).join('')}
      ${reply.context ? `<div class="care-context"><strong>Saved history included</strong><p>As of ${formatDate(reply.context.asOf)}</p><ul lang="${turn.language === 'id' ? 'id' : 'en'}">${reply.context.lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul></div>` : ''}
      ${sourceList}${reply.provider === 'ollama' ? '<p class="care-note">Topic matched by the local model.</p>' : ''}
    </article></div></li>`;
}

function companion(image, state, query) {
  const care = state.care ?? { status:'idle' };
  const greetingButton = (className, decorative = false) => `<button class="care-mascot-button" type="button" data-action="wave-lumi" aria-label="Wave to Lumi">${image('care/lumi', { className, decorative, eager:true, motion:'care/lumi-wave' })}</button>`;
  const title = `<header class="care-heading">${greetingButton('care-avatar', true)}<div><h1 id="page-title" tabindex="-1">AI Care</h1><p>Lumi · Wellness companion</p></div>${care.turns?.length ? button('clear-care-dialog', 'Clear chat', { style:'secondary' }) : ''}</header>`;
  if (care.status === 'error') return title + `<section class="surface prose"><p role="alert">The conversation could not load.</p>${button('reload-care', 'Try again', { style:'secondary' })}</section>`;
  if (care.status !== 'ready') return title + '<section class="surface prose"><p role="status">Loading conversation…</p></section>';
  const { turns, modelConfigured, language, pending } = care;
  const paused = state.account && !state.account.consent;
  const draft = !pending && query.get('prompt') === 'phase' ? cycleQuestion : '';
  const emblem = image('care/lumi', { className:'care-avatar', decorative:true });
  const waitingMascot = image('care/lumi', { className:'care-avatar', decorative:true, motion:'care/lumi-thinking' });
  return `${title}
    <section class="care-chat" aria-label="Conversation with Lumi">
      ${!turns.length ? `<div class="care-empty" data-care-empty ${pending ? 'hidden' : ''}>${greetingButton('care-portrait')}<h2>Hi, I’m Lumi.</h2><p>${paused ? 'Your conversation will appear here.' : 'What would you like to understand about your cycle or wellness?'}</p>${paused ? '' : `<div class="care-prompts" aria-label="Suggested questions">${carePrompts.map(([text], i) => `<button class="action secondary" type="button" data-care-prompt="${i}">${text}${icon('chevron')}</button>`).join('')}</div>`}</div>` : ''}
      <ol class="care-log" aria-label="Recent conversation">${turns.map((turn, i) => careTurn(turn, i === turns.length - 1, emblem)).join('')}
        <li class="care-turn" data-care-pending ${pending ? '' : 'hidden'}><div class="care-question"><p data-care-message>${escapeHtml(pending ?? '')}</p></div><div class="care-reply care-waiting">${waitingMascot}<p role="status" data-care-progress>${pending ? 'Lumi is preparing a reply…' : ''}</p></div></li>
      </ol>
      ${paused ? `<div class="surface prose"><p>Tracking consent is paused.</p>${link('privacy', 'Open Privacy &amp; data', { glyph:'right' })}</div>` : `<form data-form="care" class="care-composer">
        <div class="care-input"><textarea name="question" rows="2" maxlength="1200" aria-label="Message Lumi" required placeholder="Message Lumi…" ${pending ? 'readonly' : ''}>${draft}</textarea><button type="submit" class="action primary" aria-label="Send message" ${pending ? 'disabled' : ''}>${icon('right')}</button></div>
        <div class="care-options">
          <details><summary>Message options</summary><div class="care-controls"><label class="field"><span>Reply language</span><select name="language"><option value="en" ${language !== 'id' ? 'selected' : ''}>English</option><option value="id" ${language === 'id' ? 'selected' : ''}>Bahasa Indonesia</option></select></label><label class="setting"><input type="checkbox" name="history"><span>Include a summary of my saved records for this message</span></label></div></details>
          <details><summary>About AI Care</summary><p>For education and visit preparation. Contact a healthcare professional for diagnosis or treatment. ${modelConfigured ? 'A local model can match your question to a reviewed topic.' : 'Replies come from the education library.'} Messages and any included summary are stored locally.</p></details>
        </div>
      </form>`}
    </section>`;
}

function report(image, state) {
  const today = dateKey(new Date());
  const selection = state.report ?? defaultReportRange(today);
  const data = buildReport(state, selection);
  const metrics = [
    [data.summary.recordedDays, 'Recorded period days'], [data.moods.length, 'Mood check-ins'],
    [data.symptoms.length, 'Symptom entries'], [data.sleep.length, 'Sleep entries'],
  ];
  const groups = reportSections(data).filter(group => group.rows.length);
  const options = `<section class="surface prose report-options"><h2>Report options</h2>
      <form class="form-stack" data-form="report"><div class="form-columns">
        ${field('Start date', 'from', 'date', `value="${selection.from}" min="1900-01-01" max="${today}" required`)}
        ${field('End date', 'to', 'date', `value="${selection.to}" min="1900-01-01" max="${today}" required`)}
      </div><p class="care-note">Select up to 366 days. The downloaded file contains private information.</p>
      <label class="setting"><input type="checkbox" name="notes" ${selection.includeNotes ? 'checked' : ''}><span>Include personal journal notes</span></label>
      <div class="actions"><button type="submit" name="intent" value="preview" class="action secondary">Preview report</button>
        <button type="submit" name="intent" value="pdf" class="action primary">Download PDF</button>
        <button type="submit" name="intent" value="csv" class="action secondary">Download CSV</button></div>
      </form>
    </section>`;
  return `${heading('Health report', 'Choose the dates and records you want to review or share.')}
    <div class="report-dashboard">
    <section class="surface prose report-preview" id="report-preview" tabindex="-1" aria-labelledby="report-preview-title">
      <div class="section-top"><h2 id="report-preview-title">Report preview</h2><span>${formatDate(data.from)} – ${formatDate(data.to)}</span></div>
      <div class="report-dial"><strong>${data.periods.length + data.moods.length + data.symptoms.length + data.sleep.length + data.notes.length}</strong><span>Tracking entries</span></div>
      <dl class="report-metrics">${metrics.map(([value,label]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      <p>${selection.includeNotes ? 'Journal notes are included when available.' : 'Journal notes are excluded.'}</p>
      ${button('show-report-options', 'Export report', { glyph:'download' })}
      ${groups.length ? groups.map((group, index) => `<details class="report-detail" ${index === 0 ? 'open' : ''}><summary>${group.title}</summary>
        <div class="table-scroll" tabindex="0" role="region" aria-label="${group.title}"><table>
        <thead><tr>${group.headers.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead>
        <tbody>${group.rows.map(row => '<tr>' + row.map(cell => `<td>${escapeHtml(cell) || '—'}</td>`).join('') + '</tr>').join('')}</tbody></table></div></details>`).join('')
      : '<p>No saved records fall within the selected dates.</p>'}
    </section>${options}</div>`;
}

function library(image, query) {
  const filter = categories.includes(query.get('topic')) ? query.get('topic') : 'All';
  const search = (query.get('q') ?? '').slice(0,120);
  const address = (topic = filter, article) => {
    const params = new URLSearchParams();
    if (topic !== 'All') params.set('topic', topic);
    if (search) params.set('q', search);
    if (article) params.set('article', article);
    return 'wellness' + (params.size ? '?' + escapeHtml(params.toString()) : '');
  };
  if (query.has('article')) {
    const article = articles.find(item => item.id === query.get('article'));
    if (!article) return heading('Article unavailable', 'Find another topic in the Wellness library.', link(address(), 'Back to library', { style:'secondary' }));
    return `${link(address(), 'Back to library', { glyph:'left' })}${heading(article.title, article.summary)}
      <article class="surface story library-article">${image(article.image, { className:'library-hero' })}
        <div class="article-text">${article.sections.map(([title,text]) => `<section><h2>${title}</h2><p>${text}</p></section>`).join('')}
        <section><h2>Sources</h2><ul class="article-sources">${article.sources.map(([name,src]) => `<li><a href="${src}" target="_blank" rel="noopener noreferrer">${name}</a></li>`).join('')}</ul></section></div>
      </article>`;
  }
  const results = findArticles(filter, search);
  return `${heading('Wellness library', 'Read about cycle health, nutrition, movement, and everyday care.')}
    <form data-form="library" class="library-search"><input type="hidden" name="topic" value="${filter}">
      ${field('Search articles', 'search', 'search', `value="${escapeHtml(search)}" maxlength="120" placeholder="Try hormones or sleep"`)}
      <button type="submit" class="action primary">Search</button>${search ? `<a class="action secondary" href="#/wellness${filter === 'All' ? '' : '?topic=' + encodeURIComponent(filter)}">Clear search</a>` : ''}
    </form>
    <nav aria-label="Wellness topics" class="filters">${categories.map(topic => `<a href="#/${address(topic)}" class="action secondary" ${topic === filter ? 'aria-current="true"' : ''}>${topic}</a>`).join('')}</nav>
    ${results.length ? `<div class="library-grid">${results.map((article,index) => `<article class="surface story${index === 0 && filter === 'All' && !search ? ' story-feature' : ''}"><a href="#/${address(filter, article.id)}" class="story-link">
      ${image(article.image)}<div><span>${article.category}</span><h2>${article.title}</h2><p>${article.summary}</p></div></a></article>`).join('')}</div>`
      : '<p class="analysis-note">No articles match these filters.</p>'}`;
}

function profile(state) {
  const name = state.name || 'Local account';
  const initials = name.split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toUpperCase();
  const links = [
    ['settings', 'Settings', 'settings'], ['privacy', 'Privacy &amp; data', 'shield'],
    ['report', 'Health report', 'download'], ['wellness', 'Wellness library', 'book'], ['sleep', 'Sleep tracker', 'moon'],
  ];
  return `${heading('Profile')}
    <div class="profile-layout"><section class="profile-identity">
      <div class="profile-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
      <h2>${escapeHtml(name)}</h2><p>${escapeHtml(state.account?.email ?? '')}</p>
    </section><nav class="surface profile-links" aria-label="Account settings">
      ${links.map(([href, label, glyph]) => `<a href="#/${href}"><span>${icon(glyph)}</span>${label}${icon('chevron')}</a>`).join('')}
    </nav>${button('logout', 'Sign out', { style: 'secondary' })}</div>`;
}

function settings(state) {
  return `${link('profile', 'Back to profile', { glyph: 'left' })}${heading('Settings', 'Adjust your tracking and interface preferences.')}
    <form class="surface prose form-stack" data-form="settings"><label class="field"><span>Display name</span><input name="name" maxlength="60" value="${escapeHtml(state.name)}" required></label>${trackingFields(state.account ?? {})}<label class="setting"><input type="checkbox" name="motion" ${state.reduceMotion ? 'checked' : ''}> Reduce interface motion</label><button class="action primary" type="submit">Apply preferences</button></form>
    ${link('privacy', 'Privacy &amp; data', { glyph:'right' })}`;
}

function privacy(state) {
  const account = state.account;
  const back = account?.onboarded ? 'settings' : 'onboarding';
  const live = account?.consent;
  return `${link(back, account?.onboarded ? 'Back to settings' : 'Back to setup', { glyph:'left' })}
    ${heading('Privacy &amp; data', 'Control tracking consent, download your data, or delete this local account.')}
    <div class="stack privacy-options">
      <section class="surface prose"><h2>Tracking consent</h2>
        <p>${account?.onboarded ? live ? 'Tracking and AI Care are active. Sharing a saved-record summary still requires permission for each AI Care question.' : 'Tracking and new AI Care messages are paused. You can still read or export saved records.' : 'The initial tracking setup records your choice to store health entries on this device.'}</p>
        ${account?.onboarded ? button('privacy-consent-dialog', live ? 'Withdraw tracking consent' : 'Resume tracking', { style:'secondary' }) : ''}
      </section>
      <section class="surface prose"><h2>Download account data</h2>
        <p>Download a JSON file with account details, tracking entries, consent history, and AI Care messages. It contains private information.</p>
        ${button('privacy-export-dialog', 'Export account data', { style:'secondary' })}
      </section>
      <section class="surface prose"><h2>Delete account</h2>
        <p>Permanently removes your account, tracking entries, and conversations from the active database on this installation. Existing downloads and prior backups are managed separately.</p>
        ${button('privacy-delete-dialog', 'Delete account', { style:'danger' })}
      </section>
    </div>`;
}

export function renderScreen(route, image, state) {
  const screens = {
    welcome: () => welcome(image), login: () => auth(image, false), register: () => auth(image, true), recovery: () => recovery(image),
    onboarding: () => onboarding(image, state), home: () => home(image, state),
    cycle: () => cycle(image, state), 'cycle-details': () => cycleDetail(image, route.query),
    mood: () => mood(image, state), symptoms: () => symptomScreen(image, state), sleep: () => sleep(image, state), insights: () => insights(image, state),
    companion: () => companion(image, state, route.query), report: () => report(image, state), wellness: () => library(image, route.query),
    profile: () => profile(state), settings: () => settings(state), privacy: () => privacy(state),
  };
  return screens[route.name]();
}
