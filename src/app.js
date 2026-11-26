import { button, createImage, escapeHtml, field, icon } from './components.js';
import { carePrompts, dateKey, moodPortrait, moods, primaryNav, renderScreen, routeFromHash, symptoms } from './screens.js';
import { defaultReportRange, reportFileName, reportRangeError } from './report-data.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const entryRoutes = new Set(['welcome', 'login', 'register', 'recovery', 'onboarding']);
const relatives = { 'cycle-details': 'cycle', mood: 'home', symptoms: 'home', sleep: 'home', report: 'profile', settings: 'profile', privacy:'profile' };
let state = initialState();
let image;
let toastTimer;
let pendingWrite = false;
const activeMotion = new WeakMap();
let mascotPlayback = 0;

function initialState() {
  const now = new Date();
  return {
    step: 0, name: '', account: null, mood: '', moods: [], journal: [], symptoms: [], cycles: [], sleep: [], analysis: null, selectedDate: '',
    month: { year: now.getFullYear(), month: now.getMonth() }, care: { status:'idle', language:'en' },
    report: defaultReportRange(dateKey(now)), reduceMotion: false,
  };
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  reveal(toast, { y:6, duration:170 });
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 3500);
}

function motionAllowed() {
  return !state.reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function playMotion(element, frames, duration) {
  if (!element?.isConnected || !element.animate) return;
  activeMotion.get(element)?.cancel();
  if (!motionAllowed()) return;
  const animation = element.animate(frames, { duration, easing:'cubic-bezier(.2,.75,.28,1)' });
  activeMotion.set(element, animation);
  animation.onfinish = () => {
    if (activeMotion.get(element) === animation) activeMotion.delete(element);
  };
}

function playMascot(image) {
  if (!image || !motionAllowed()) return false;
  const { mascotMotion, mascotDuration } = image.dataset;
  image.dataset.mascotStill ??= image.getAttribute('src');
  const src = `${mascotMotion}?play=${++mascotPlayback}`;
  const restore = () => {
    if (image.isConnected && image.getAttribute('src') === src) image.src = image.dataset.mascotStill;
  };
  image.src = src;
  image.decode().then(() => setTimeout(restore, Number(mascotDuration)), restore);
  return true;
}

function reveal(element, { x = 0, y = 0, duration = 190 } = {}) {
  playMotion(element, [
    { opacity:.65, transform:`translate(${x}px,${y}px)` },
    { opacity:1, transform:'translate(0,0)' },
  ], duration);
}

function navigation(items, active) {
  return items.map(([href, label, glyph]) =>
    `<a href="#/${href}" ${href === active ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`
  ).join('');
}

function render(focusPage = false) {
  if (!image) return;
  const route = routeFromHash(location.hash);
  if (!state.account && !entryRoutes.has(route.name)) {
    location.replace('#/login');
    return;
  }
  if (state.account && !state.account.onboarded && !entryRoutes.has(route.name) && route.name !== 'privacy') {
    state.step = 4;
    location.replace('#/onboarding');
    return;
  }
  if (state.account && ['login', 'register', 'recovery'].includes(route.name)) {
    location.replace(state.account.onboarded ? '#/home' : '#/onboarding');
    return;
  }
  const content = renderScreen(route, image, state);
  const active = relatives[route.name] ?? route.name;
  const standalonePrivacy = route.name === 'privacy' && !state.account?.onboarded;
  if (entryRoutes.has(route.name) || standalonePrivacy) {
    app.innerHTML = `<main id="main" ${standalonePrivacy ? 'class="workspace"' : ''} tabindex="-1">${content}</main>`;
  } else {
    app.innerHTML = `<div class="app-layout"><aside class="rail">
      <a href="#/home" class="rail-logo">${image('brand/logo-primary', { eager: true })}</a>
      <nav class="desktop-nav" aria-label="Main">${navigation(primaryNav, active)}</nav>
      <nav class="desktop-nav supporting" aria-label="Library and records">${navigation([['wellness','Wellness library','book'],['report','Health report','note']], route.name)}</nav>
    </aside><div class="shell">
      <header class="app-header"><a href="#/home" class="header-logo">${image('brand/logo-mark', { decorative: true })}<span>LUNARA</span></a><div class="header-actions"><a href="#/wellness" class="icon-button" aria-label="Wellness library">${icon('book')}</a><a href="#/settings" class="icon-button" aria-label="Settings">${icon('settings')}</a></div></header>
      <main id="main" class="workspace" data-screen="${route.name}" tabindex="-1">${content}</main>
      <nav class="mobile-nav" aria-label="Main">${navigation(primaryNav, active)}</nav></div></div>`;
  }
  document.documentElement.classList.toggle('reduce-motion', state.reduceMotion);
  const heading = document.querySelector('#page-title');
  document.title = route.name === 'welcome' ? 'LUNARA' : `${heading.textContent} | LUNARA`;
  if (focusPage) {
    window.scrollTo(0, 0);
    heading.focus({ preventScroll: true });
    if (route.name === 'companion') document.querySelector('#latest-answer')?.scrollIntoView({ block:'start' });
  }
  if (route.name === 'companion') {
    if (state.care.status === 'idle') loadCare();
    if (state.care.pending) playMascot(document.querySelector('[data-care-pending] img'));
    if (state.care.status === 'ready' && route.query.get('prompt') === 'phase') history.replaceState(null, '', '#/companion');
  }
}

function modal(title, content) {
  dialog.innerHTML = `<div class="modal-title"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Close dialog">${icon('close')}</button></div><p class="form-error" role="alert"></p>${content}`;
  dialog.showModal();
}

function periodModal(start, selectedDate = state.selectedDate) {
  const today = dateKey(new Date());
  const selected = selectedDate && selectedDate <= today ? selectedDate : today;
  const record = start ? state.cycles.find(range => range.start === start) : state.cycles.find(range => range.start <= selected && selected <= (range.end ?? today));
  const recordedEnd = record?.source === 'start-only' || (record?.source === 'legacy' && record.start === record.end) ? '' : record?.end ?? '';
  modal(record ? 'Edit a period' : 'Log a period', `<form data-form="period" class="form-stack">
    <input type="hidden" name="previous" value="${record?.start ?? ''}">
    ${field('Start date', 'start', 'date', `value="${record?.start ?? selected}" max="${today}" required`)}
    ${field('End date (optional)', 'end', 'date', `value="${recordedEnd}" max="${today}"`)}
    <p>Leave the end date blank to save an open period. Use the same start and end date to log one day.</p>
    <div class="actions"><button class="action primary" type="submit">Save period</button>${record ? button('remove-period', 'Remove period', { style: 'secondary' }) : ''}</div></form>`);
}

function symptomModal() {
  modal('Log a symptom', `<form data-form="symptom" class="form-stack">
    <label class="field"><span>Symptom</span><select name="name" required>${symptoms.map(name => `<option>${name}</option>`).join('')}</select></label>
    <div data-custom-symptom hidden>${field('Custom symptom', 'custom', 'text', 'maxlength="60" disabled')}</div>
    <label class="field"><span>Severity</span><select name="severity" required><option>Mild</option><option>Moderate</option><option>Severe</option></select></label>
    <div class="form-columns">${field('Date', 'date', 'date', `value="${dateKey(new Date())}" max="${dateKey(new Date())}" required`)}
    ${field('Time', 'time', 'time', `value="${localTime()}" required`)}</div>
    <button class="action primary" type="submit">Save symptom</button></form>`);
}

function localTime() {
  const date = new Date();
  return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
}

function sleepModal() {
  const today = dateKey(new Date());
  const existing = state.sleep.find(entry => entry.date === today);
  modal('Log sleep', `<form data-form="sleep" class="form-stack">
    ${field('Date', 'date', 'date', `value="${today}" max="${today}" required`)}
    <div class="form-columns">${field('Hours', 'hours', 'number', `min="0" max="24" value="${existing ? Math.floor(existing.minutes / 60) : ''}" required`)}
    ${field('Minutes', 'minutes', 'number', `min="0" max="59" value="${existing ? existing.minutes % 60 : '0'}" required`)}</div>
    <label class="field"><span>Sleep quality</span><select name="quality" required>${['Restful','Mixed','Poor'].map(quality => `<option ${existing?.quality === quality ? 'selected' : ''}>${quality}</option>`).join('')}</select></label>
    <button class="action primary" type="submit">Save sleep</button></form>`);
}

function privacyModal(kind) {
  if (kind === 'consent') {
    const active = state.account.consent;
    modal(active ? 'Withdraw tracking consent?' : 'Resume tracking?', `<form data-form="privacyConsent" class="form-stack">
      <input type="hidden" name="granted" value="${!active}">
      <p>${active ? 'This pauses new tracking entries and AI Care messages. Your saved records remain available for review and export.' : 'Resuming allows LUNARA to process your tracking entries and AI Care messages on this device.'}</p>
      ${active ? '' : '<label class="setting"><input type="checkbox" name="approved" required><span>I agree to resume tracking.</span></label>'}
      <button class="action ${active ? 'secondary' : 'primary'}" type="submit">${active ? 'Withdraw consent' : 'Resume tracking'}</button></form>`);
    return;
  }
  const deleting = kind === 'delete';
  const title = deleting ? 'Delete this account?' : 'Export account data';
  modal(title, `<form data-form="${deleting ? 'privacyDelete' : 'privacyExport'}" class="form-stack">
    <p>${deleting ? 'This action permanently removes your account and all saved records from the active database.' : 'Confirm your password to download a private JSON file.'}</p>
    ${field('Current password', 'password', 'password', 'autocomplete="current-password" minlength="10" maxlength="128" required')}
    ${deleting ? field('Type DELETE to confirm', 'confirmation', 'text', 'autocomplete="off" pattern="DELETE" required') : ''}
    <button class="action ${deleting ? 'danger' : 'primary'}" type="submit">${deleting ? 'Permanently delete account' : 'Download JSON'}</button></form>`);
}

async function api(path, data, file = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.account) headers['X-Lunara-Account'] = state.account.id;
  const response = await fetch('/api/' + path, data === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(data) });
  if (file && response.ok) return response.blob();
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.account && !['login', 'recover'].includes(path)) {
      state = initialState();
      if (dialog.open) dialog.close();
      location.replace('#/login');
    }
    throw new Error(payload.error);
  }
  if (Object.hasOwn(payload, 'user')) applySnapshot(payload);
  return payload;
}

function applySnapshot(payload) {
  if (!payload.user) {
    state = initialState();
    return;
  }
  if (state.account?.id !== payload.user.id) state = initialState();
  state.account = payload.user;
  state.name = payload.user.name;
  state.reduceMotion = payload.user.reduceMotion;
  for (const key of ['cycles','moods','journal','symptoms','sleep']) state[key] = payload[key];
  state.analysis = payload.analysis;
  state.mood = state.moods.find(entry => entry.date === dateKey(new Date()))?.mood ?? '';
}

async function loadCare() {
  const care = state.care;
  care.status = 'loading';
  try {
    const data = await api('companion');
    Object.assign(care, data, { status:'ready' });
  } catch {
    care.status = 'error';
  }
  if (state.care === care && routeFromHash(location.hash).name === 'companion') {
    render();
    document.querySelector('#latest-answer')?.scrollIntoView({ block:'start' });
  }
}

function updateCare(care, payload) {
  const latest = payload.turns.at(-1)?.id;
  const isNewReply = latest && latest !== care.turns?.at(-1)?.id;
  Object.assign(care, payload, { status:'ready' });
  if (state.care !== care || routeFromHash(location.hash).name !== 'companion') return;
  render();
  const reply = document.querySelector('#latest-answer');
  (reply ?? document.querySelector('[data-form="care"] textarea'))?.focus({ preventScroll:true });
  reply?.scrollIntoView({ block:'start' });
  if (isNewReply) reveal(reply, { y:8, duration:240 });
}

function onboardingNext(skip = false) {
  const next = skip ? 4 : Math.min(state.step + 1, 4);
  state.step = next;
  if (next === 4 && !state.account) {
    location.hash = '/register';
    return;
  }
  revealOnboarding(1);
}

function revealOnboarding(direction) {
  render(true);
  reveal(document.querySelector('.entry-art'), { x:direction * 10, duration:220 });
  reveal(document.querySelector('.entry-copy .page-heading'), { x:direction * 6, duration:195 });
}

function showRecoveryCode(code, route) {
  modal('Save your recovery code', `<p>You’ll need this code if you forget your password. Save it somewhere private.</p>
    <p class="recovery-code"><code>${escapeHtml(code)}</code></p>
    <button class="action primary" type="button" data-action="close-dialog">I’ve saved it</button>`);
  dialog.addEventListener('close', () => {
    location.hash = '/' + route;
    render(true);
  }, { once: true });
}

function shiftMonth(delta) {
  const date = new Date(state.month.year, state.month.month + delta, 1);
  state.month = { year: date.getFullYear(), month: date.getMonth() };
  render();
  const action = delta < 0 ? 'month-back' : 'month-next';
  document.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll:true });
  reveal(document.querySelector('.calendar-grid'), { x:delta * 10, duration:210 });
  reveal(document.querySelector('.calendar-title h2'), { x:delta * 5 });
}

const actions = {
  'onboard-next': () => onboardingNext(),
  'onboard-skip': () => onboardingNext(true),
  'onboard-back': () => { state.step--; revealOnboarding(-1); },
  'month-back': () => shiftMonth(-1),
  'month-next': () => shiftMonth(1),
  'period-dialog': () => periodModal(),
  'today-period-dialog': () => periodModal(undefined, dateKey(new Date())),
  'symptom-dialog': symptomModal,
  'sleep-dialog': sleepModal,
  'privacy-consent-dialog': () => privacyModal('consent'),
  'privacy-export-dialog': () => privacyModal('export'),
  'privacy-delete-dialog': () => privacyModal('delete'),
  'reload-care': () => { state.care.status = 'idle'; render(); },
  'wave-lumi': control => {
    if (!playMascot(control.querySelector('img'))) notify('Lumi says hi!');
  },
  'show-report-options': () => document.querySelector('[data-form="report"] [name="from"]')?.focus(),
  'clear-care-dialog': () => modal('Clear conversation?', `<p>This removes the saved messages and included summaries from your account’s active database.</p>
    <div class="actions">${button('clear-care', 'Clear conversation')}${button('close-dialog', 'Keep conversation', { style:'secondary' })}</div>`),
  'clear-care': async () => {
    const care = state.care;
    const data = await api('companion/clear', { revision:care.revision });
    dialog.close();
    updateCare(care, data);
    notify('Conversation cleared.');
  },
  'close-dialog': () => dialog.close(),
  'remove-period': async () => {
    await api('period/remove', { start: dialog.querySelector('[name="previous"]').value });
    closeAndUpdate(currentPeriodAction(), 'Period removed.');
  },
  'logout': async () => {
    await api('logout', {});
    location.hash = '/welcome';
    notify('Signed out.');
  },
};

function closeAndUpdate(focusAction, message) {
  dialog.close();
  render();
  document.querySelector(`[data-action="${focusAction}"]`)?.focus();
  notify(message);
}

function currentPeriodAction() {
  return routeFromHash(location.hash).name === 'home' ? 'today-period-dialog' : 'period-dialog';
}

function refreshMoodSummary() {
  const route = routeFromHash(location.hash);
  const selector = route.name === 'home' ? '[data-today-checkin]' : '.stack';
  if (route.name !== 'home' && route.name !== 'mood') return;
  const summary = document.querySelector(selector);
  if (!summary) return;
  const template = document.createElement('template');
  template.innerHTML = renderScreen(route, image, state);
  const updated = template.content.querySelector(selector);
  if (route.name === 'home') summary.replaceChildren(...updated.childNodes);
  else summary.replaceWith(updated);
}

function showSavedMood(control) {
  for (const option of document.querySelectorAll('[data-mood]')) {
    option.setAttribute('aria-pressed', String(option.dataset.mood === state.mood));
  }
  const hero = document.querySelector('[data-mood-hero]');
  if (hero) hero.innerHTML = moodPortrait(image, state.mood);
  const frames = [
    { transform:'translateY(3px) scale(.9)', opacity:.7 },
    { transform:'translateY(-2px) scale(1.07)', opacity:1, offset:.57 },
    { transform:'translateY(0) scale(1)', opacity:1 },
  ];
  for (const artwork of [control.querySelector('img'), hero?.querySelector('img')]) {
    playMotion(artwork, frames, 320);
  }
}

async function write(task, control) {
  if (pendingWrite) return;
  pendingWrite = true;
  const alert = dialog.open ? dialog.querySelector('.form-error') : null;
  if (alert) alert.textContent = '';
  if (control) control.disabled = true;
  try {
    await task();
  } catch (error) {
    const message = error.message === 'Failed to fetch' ? 'Could not reach LUNARA. Try again.' : error.message;
    if (dialog.open && alert?.isConnected) alert.textContent = message;
    else notify(message);
  } finally {
    if (control) control.disabled = false;
    pendingWrite = false;
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip')) {
    event.preventDefault();
    document.querySelector('#main')?.focus();
    return;
  }
  const control = event.target.closest('button[data-action],button[data-mood],button[data-date],button[data-care-prompt],button[data-period-start]');
  if (!control) return;
  const { action, mood, date, carePrompt, periodStart } = control.dataset;
  if (action && ['remove-period', 'logout', 'clear-care'].includes(action)) write(actions[action], control);
  else if (action && !(pendingWrite && action === 'close-dialog')) actions[action]?.(control);
  if (periodStart) periodModal(periodStart);
  if (mood && moods.includes(mood)) {
    write(async () => {
      await api('mood', { date: dateKey(new Date()), mood });
      showSavedMood(control);
      refreshMoodSummary();
      notify(`Mood saved as ${mood.toLowerCase()}.`);
    }, control);
  }
  if (date) {
    state.selectedDate = date;
    render();
    const selected = document.querySelector(`[data-date="${date}"]`);
    selected?.focus({ preventScroll:true });
    playMotion(selected, [{ transform:'scale(.94)' }, { transform:'scale(1)' }], 180);
  }
  if (carePrompt !== undefined && !pendingWrite) {
    const field = document.querySelector('[data-form="care"] textarea');
    field.value = carePrompts[Number(carePrompt)][1];
    field.focus();
  }
});

dialog.addEventListener('cancel', event => {
  if (pendingWrite) event.preventDefault();
});

dialog.addEventListener('change', event => {
  if (event.target.matches('[data-form="sleep"] input[name="date"]')) {
    const entry = state.sleep.find(record => record.date === event.target.value);
    event.target.form.elements.hours.value = entry ? Math.floor(entry.minutes / 60) : '';
    event.target.form.elements.minutes.value = entry ? entry.minutes % 60 : '0';
    event.target.form.elements.quality.value = entry?.quality ?? 'Restful';
    return;
  }
  if (!event.target.matches('[data-form="symptom"] select[name="name"]')) return;
  const input = dialog.querySelector('[name="custom"]');
  const custom = event.target.value === 'Other';
  input.closest('[data-custom-symptom]').hidden = !custom;
  input.disabled = !custom;
  input.required = custom;
});

function preferences(data) {
  return {
    name: data.get('name') ?? state.name, tracking: data.get('tracking'),
    cycleLength: optionalNumber(data.get('cycleLength')), periodLength: optionalNumber(data.get('periodLength')),
    reduceMotion: data.has('motion'),
  };
}

function optionalNumber(value) {
  return value ? Number(value) : null;
}

const entryIds = new WeakMap();
function submissionId(form) {
  if (!entryIds.has(form)) entryIds.set(form, crypto.randomUUID());
  return entryIds.get(form);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const submit = {
  library(data) {
    const query = new URLSearchParams();
    const topic = data.get('topic');
    const search = String(data.get('search') ?? '').trim();
    if (topic && topic !== 'All') query.set('topic', topic);
    if (search) query.set('q', search);
    const target = '#/wellness' + (query.size ? '?' + query : '');
    if (location.hash !== target) location.hash = target;
  },
  async report(data) {
    const selection = { from:data.get('from'), to:data.get('to'), includeNotes:data.has('notes') };
    const error = reportRangeError(selection, dateKey(new Date()));
    if (error) throw new Error(error);
    state.report = selection;
    const intent = data.get('intent');
    if (!['pdf','csv'].includes(intent)) {
      render();
      document.querySelector('#report-preview')?.focus();
      return;
    }
    const blob = await api('report/export', { ...selection, format:intent }, true);
    downloadBlob(blob, reportFileName(selection, intent));
    if (routeFromHash(location.hash).name === 'report') render();
    notify(`${intent.toUpperCase()} report prepared.`);
  },
  async privacyConsent(data) {
    const granted = data.get('granted') === 'true';
    if (granted && !data.has('approved')) throw new Error('Confirm that you want to resume tracking.');
    await api('privacy/consent', { granted });
    closeAndUpdate('privacy-consent-dialog', granted ? 'Tracking resumed.' : 'Tracking consent withdrawn.');
  },
  async privacyExport(data) {
    const blob = await api('privacy/export', { password:data.get('password') }, true);
    downloadBlob(blob, 'lunara-account-data.json');
    dialog.close();
    notify('Account data prepared.');
  },
  async privacyDelete(data) {
    await api('privacy/delete', Object.fromEntries(data));
    dialog.close();
    location.replace('#/welcome');
    notify('Account deleted.');
  },
  async register(data) {
    const finishedIntro = state.step >= 4;
    const payload = await api('register', Object.fromEntries(data));
    if (finishedIntro) state.step = 4;
    showRecoveryCode(payload.recoveryCode, 'onboarding');
  },
  async login(data) {
    await api('login', Object.fromEntries(data));
    if (!state.account.onboarded) state.step = 4;
    location.hash = state.account.onboarded ? '/home' : '/onboarding';
    notify('Signed in.');
  },
  async recover(data) {
    const payload = await api('recover', Object.fromEntries(data));
    state = initialState();
    showRecoveryCode(payload.recoveryCode, 'login');
  },
  async setup(data) {
    await api('preferences', { ...preferences(data), complete: true, consent: data.has('consent'), lastPeriod: data.get('lastPeriod') });
    location.hash = '/home';
    notify('Tracking preferences saved.');
  },
  async journal(data, form) {
    await api('journal', { id: submissionId(form), date: dateKey(new Date()), note: data.get('entry') });
    entryIds.delete(form);
    form.reset();
    updateMoodHistory();
    if (form.isConnected) form.elements.entry.focus();
    notify('Journal entry saved.');
  },
  async checkin(data) {
    if (!state.mood) throw new Error('Choose a mood before saving your check-in.');
    await api('mood', { date: dateKey(new Date()), mood: state.mood, energy: optionalNumber(data.get('energy')), stress: optionalNumber(data.get('stress')) });
    updateMoodHistory();
    notify('Check-in saved.');
  },
  async period(data) {
    await api('period', Object.fromEntries(data));
    state.selectedDate = data.get('start');
    const [year, month] = state.selectedDate.split('-').map(Number);
    state.month = { year, month: month - 1 };
    closeAndUpdate(currentPeriodAction(), 'Period saved.');
  },
  async symptom(data, form) {
    await api('symptom', { ...Object.fromEntries(data), id: submissionId(form) });
    closeAndUpdate('symptom-dialog', 'Symptom saved.');
  },
  async sleep(data) {
    await api('sleep', { date: data.get('date'), minutes: Number(data.get('hours')) * 60 + Number(data.get('minutes')), quality: data.get('quality') });
    closeAndUpdate('sleep-dialog', 'Sleep saved.');
  },
  async care(data, form) {
    const care = state.care;
    const question = data.get('question').trim();
    const input = form.elements.question;
    if (!question) { input.value = ''; input.reportValidity(); return; }
    const pending = document.querySelector('[data-care-pending]');
    const empty = document.querySelector('[data-care-empty]');
    care.pending = question;
    input.readOnly = true;
    input.value = '';
    pending.querySelector('[data-care-message]').textContent = question;
    if (empty) empty.hidden = true;
    pending.hidden = false;
    pending.querySelector('[data-care-progress]').textContent = 'Lumi is preparing a reply…';
    playMascot(pending.querySelector('img'));
    reveal(pending, { y:6, duration:200 });
    pending.scrollIntoView({ block:'nearest' });
    try {
      const payload = await api('companion', {
        id:submissionId(form), revision:care.revision, question,
        language:data.get('language'), includeHistory:data.has('history'),
      });
      delete care.pending;
      care.language = data.get('language');
      updateCare(care, payload);
    } catch (error) {
      delete care.pending;
      if (state.care === care && routeFromHash(location.hash).name === 'companion') {
        if (!form.isConnected) render();
        const composer = document.querySelector('[data-form="care"]');
        if (composer) {
          composer.elements.question.readOnly = false;
          composer.elements.question.value = question;
          composer.elements.language.value = data.get('language');
          composer.elements.history.checked = data.has('history');
          document.querySelector('[data-care-pending]').hidden = true;
          const greeting = document.querySelector('[data-care-empty]');
          if (greeting) greeting.hidden = false;
        }
      }
      throw error;
    }
  },
  async settings(data) {
    await api('preferences', preferences(data));
    document.documentElement.classList.toggle('reduce-motion', state.reduceMotion);
    notify('Preferences applied.');
  },
};

document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  const input = event.target.closest('[data-form="care"] textarea');
  if (!input) return;
  event.preventDefault();
  if (!pendingWrite && input.value.trim()) input.form.requestSubmit(input.form.querySelector('[type="submit"]'));
});

document.addEventListener('submit', event => {
  if (!event.target.dataset.form) return;
  event.preventDefault();
  const handler = submit[event.target.dataset.form];
  if (handler) {
    const data = new FormData(event.target);
    if (event.submitter?.name === 'intent') data.set('intent', event.submitter.value);
    write(() => handler(data, event.target), event.submitter);
  }
});

window.addEventListener('hashchange', () => {
  const previousTab = document.querySelector('.mobile-nav [aria-current="page"]')?.getAttribute('href');
  if (dialog.open) dialog.close();
  render(true);
  const nextTab = document.querySelector('.mobile-nav [aria-current="page"]');
  if (previousTab && nextTab?.getAttribute('href') !== previousTab) {
    reveal(nextTab?.querySelector('.icon'), { y:3, duration:160 });
  }
});

async function start() {
  app.innerHTML = '<main id="main" class="loading" tabindex="-1" aria-busy="true"><p role="status">Loading LUNARA…</p><div class="skeleton" aria-hidden="true"></div></main>';
  try {
    const [response] = await Promise.all([fetch('/assets/catalog.json', { cache:'no-cache' }), api('session')]);
    if (!response.ok) throw new Error('Asset catalog unavailable');
    image = createImage(await response.json());
    render();
  } catch {
    app.innerHTML = `<main id="main" tabindex="-1" class="loading"><h1>LUNARA couldn’t load</h1><p>Reload to try again.</p><button class="action primary" type="button" id="retry">Reload</button></main>`;
    document.querySelector('#retry').addEventListener('click', start, { once: true });
  }
}

start();
