import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { createImage } from '../src/components.js';
import { dateKey, monthDays, renderScreen, routeFromHash, routes } from '../src/screens.js';
import { appServer } from '../server.mjs';

const assetRoot = new URL('../public/assets/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', assetRoot), 'utf8'));
const image = createImage(catalog);
const preview = {
  step: 0, name: '<visitor>', mood: 'Calm', journal: [], symptoms: [], cycles: [], sleep: [], moods: [],
  selectedDate: '', month: { year: 2024, month: 1 }, companionTopic: -1, reduceMotion: false,
};

test('all 18 routes render a page heading and resolve every artwork reference', async () => {
  assert.equal(routes.size, 18);
  for (const route of routes) {
    const markup = renderScreen(routeFromHash('#/' + route), image, preview);
    assert.match(markup, /<h1 id="page-title"/, route);
    for (const match of markup.matchAll(/<img [^>]*src="\/assets\/([^"]+)"[^>]*alt="[^"]*"/g)) {
      await stat(new URL(match[1], assetRoot));
    }
    assert.equal(markup.match(/<img /g)?.length ?? 0, [...markup.matchAll(/<img [^>]*alt="/g)].length);
    assert.doesNotMatch(markup, /<visitor>/);
  }
});

test('calendar lays out February correctly in leap and common years', () => {
  const leap = monthDays(2024, 1);
  assert.deepEqual(leap.slice(0, 5), [null, null, null, 1, 2]);
  assert.equal(leap.at(-1), 29);
  assert.equal(monthDays(2025, 1).at(-1), 28);
  assert.equal(dateKey(new Date(2024, 1, 9)), '2024-02-09');
});

test('mobile mood artwork decorates labeled controls and paused tracking suppresses forecasts', () => {
  for (const route of ['home','mood']) {
    const screen = renderScreen(routeFromHash('#/' + route), image, preview);
    const choices = [...screen.matchAll(/data-mood="(\w+)" aria-pressed="(true|false)"[^>]*><span[^>]*><img[^>]*src="\/assets\/mood\/(\w+)\.webp"[^>]*alt=""/g)];
    assert.equal(choices.length, 5);
    assert.ok(choices.every(([, label, selected, slug]) => label.toLowerCase() === slug && (selected === 'true') === (label === 'Calm')));
    if (route === 'home') assert.match(screen, /\/assets\/editorial\/chiffon-orbit\.webp/);
    else assert.match(screen, /data-mood-hero[^>]*>.*\/assets\/mood\/calm\.webp.*<p>Calm<\/p>/);
  }
  const paused = renderScreen(routeFromHash('#/home'),image,{ ...preview, account:{ consent:false } });
  const empty = renderScreen(routeFromHash('#/home'),image,preview);
  assert.match(empty, /Saved period starts appear here/);
  assert.doesNotMatch(empty, /class="estimate-date"/);
  assert.match(paused, /Tracking is paused/);
  assert.equal([...paused.matchAll(/data-mood="\w+" aria-pressed="\w+" disabled/g)].length, 5);
  assert.doesNotMatch(paused, /Next period estimate/);
});

test('Today combines observed cycle data with real daily logs and consent-aware actions', () => {
  const route = routeFromHash('#/home');
  const today = dateKey(new Date());
  const populated = { ...preview, mood:'Calm', cycles:[{ start:today, end:today }],
    moods:[{ date:today, mood:'Calm', energy:4, stress:2 }], sleep:[{ date:today, minutes:462 }],
    symptoms:[{ date:today }, { date:'2000-01-01' }],
    analysis:{ cycle:{ phaseToday:'recorded-menstrual-day', next:{ status:'estimated', from:today, to:today } } },
  };
  const home = renderScreen(route, image, populated);
  assert.match(home, /cycle-glance[\s\S]*Day<\/span><strong>1[\s\S]*cycle-estimate[\s\S]*>Estimate</);
  assert.match(home, /Calm logged[\s\S]*Energy 4\/5[\s\S]*Stress 2\/5/);
  assert.match(home, /data-action="symptom-dialog"[^>]*>[\s\S]*1 entry today/);
  assert.match(home, /data-action="sleep-dialog"[^>]*>[\s\S]*7 h 42 min/);
  assert.match(home, /today-care" href="#\/companion\?prompt=phase"/);
  const draft = renderScreen(routeFromHash('#/companion?prompt=phase'), image, { ...preview, care:{ status:'ready', turns:[] } });
  assert.match(draft, /aria-label="Message Lumi"[^>]*>What do cycle phases mean\?<\/textarea>/);
  const empty = renderScreen(route, image, preview);
  assert.match(empty, /Log first period/);
  assert.doesNotMatch(empty, /class="cycle-estimate"|class="today-energy"/);
  const paused = renderScreen(route, image, { ...populated, account:{ consent:false } });
  assert.match(paused, /Manage tracking[\s\S]*Symptom history[\s\S]*Sleep history/);
  assert.doesNotMatch(paused, /data-action="(?:today-period|symptom|sleep)-dialog"|class="cycle-estimate"/);
});

test('AI Care shows Lumi in empty and populated chat and keeps the latest reply focusable', () => {
  const render = (care) => renderScreen(routeFromHash('#/companion'),image,{ ...preview, care });
  const base = { status:'ready', language:'en', turns:[] };
  assert.match(render(base), /aria-label="Wave to Lumi"><img class="care-portrait" src="\/assets\/care\/lumi\.webp"[^>]*alt="Lumi,[^>]*data-mascot-motion="\/assets\/care\/lumi-wave\.gif"/);
  const turn = { question:'Can you explain this?', language:'en', reply:{ kind:'education', sources:[], paragraphs:['Reply'] } };
  const populated = render({ ...base, turns:[turn] });
  assert.match(populated, /class="care-reply"><img class="care-avatar" src="\/assets\/care\/lumi\.webp"[^>]*alt=""/);
  assert.match(populated, /id="latest-answer" tabindex="-1"/);
  assert.doesNotMatch(populated, /data-care-prompt=/);
  const waiting = render({ ...base, pending:'A <draft> question' });
  assert.match(waiting, /data-care-empty hidden/);
  assert.match(waiting, /A &lt;draft&gt; question/);
  assert.match(waiting, /class="care-reply care-waiting"><img[^>]*data-mascot-motion="\/assets\/care\/lumi-thinking\.gif"/);
  assert.match(waiting, /aria-label="Send message" disabled/);
  assert.match(waiting, /data-care-progress>Lumi is preparing a reply/);
  assert.match(render({ status:'error' }), /role="alert"/);
});

test('energy and stress offer exclusive 1–5 selections and a reversible unlogged state', () => {
  const route = routeFromHash('#/mood');
  const entry = { date:dateKey(new Date()), mood:'Calm', energy:4, stress:2 };
  const populated = renderScreen(route,image,{ ...preview, moods:[entry] });
  for (const [name, selected] of [['energy',4],['stress',2]]) {
    const inputs = [...populated.matchAll(new RegExp(`type="radio" name="${name}" value="(\\d*)"[^>]*>`, 'g'))];
    assert.deepEqual(inputs.map(match => match[1]), ['1','2','3','4','5','']);
    assert.deepEqual(inputs.filter(match => match[0].includes(' checked')).map(match => match[1]), [String(selected)]);
    assert.match(renderScreen(route,image,preview), new RegExp(`name="${name}" value="" checked`));
  }
});

test('route filters work and unrecognized addresses return the welcome screen', () => {
  const wellness = routeFromHash('#/wellness?topic=Cycle%20basics');
  assert.equal(wellness.query.get('topic'), 'Cycle basics');
  const markup = renderScreen(wellness, image, preview);
  assert.match(markup, /Exploring cycle language/);
  assert.doesNotMatch(markup, /Sleep & recovery/);
  assert.equal(routeFromHash('#/unknown').name, 'welcome');
});

test('local server serves application entry points and artwork', async () => {
  const events = [];
  const server = appServer({ logRequest:event => events.push(event) });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [path, kind] of [
      ['/', 'text/html'], ['/src/app.js', 'text/javascript'], ['/src/styles.css', 'text/css'],
      ['/assets/catalog.json', 'application/json'], ['/assets/editorial/hero-fabric.webp', 'image/webp'],
      ['/assets/care/lumi-wave.gif?play=1', 'image/gif'], ['/assets/care/lumi-thinking.gif', 'image/gif'],
      ['/assets/fonts/literata-latin.woff2', 'font/woff2'],
      ...[400,600,700].map(weight => [`/assets/fonts/be-vietnam-pro-latin-${weight}.woff2`, 'font/woff2']),
    ]) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, path);
      assert.ok(response.headers.get('content-type').startsWith(kind));
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.match(response.headers.get('content-security-policy'), /font-src 'self'/);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      await response.arrayBuffer();
    }
    assert.equal((await fetch(origin + '/missing')).status, 404);
    const health = await fetch(origin + '/healthz?probe=synthetic-marker');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await health.json(), { status:'ok' });
    const healthHead = await fetch(origin + '/healthz', { method:'HEAD' });
    assert.equal(healthHead.status, 200);
    assert.equal(await healthHead.text(), '');
    assert.equal((await fetch(origin + '/healthz', { method:'POST' })).status, 405);
    assert.ok(events.some(event => event.route === 'health' && event.status === 200));
    for (const event of events) {
      assert.deepEqual(Object.keys(event).sort(), ['duration_ms','event','route','status']);
      assert.ok(Number.isFinite(event.duration_ms));
    }
    assert.doesNotMatch(JSON.stringify(events), /synthetic-marker/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('static assets revalidate without transferring the image body or caching private responses', async () => {
  const server = appServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = origin + '/assets/editorial/hero-fabric.webp';
    const image = await fetch(url);
    const bytes = await image.arrayBuffer();
    assert.ok(bytes.byteLength > 50_000);
    const tag = image.headers.get('etag');
    assert.match(tag, /^W\//);
    assert.equal(image.headers.get('cache-control'), 'public, max-age=300');
    const head = await fetch(url, { method:'HEAD' });
    assert.equal(head.headers.get('etag'), tag);
    assert.equal(Number(head.headers.get('content-length')), bytes.byteLength);
    assert.equal(await head.text(), '');
    const cached = await fetch(url, { headers:{ 'If-None-Match':'"old", ' + tag.slice(2) } });
    assert.equal(cached.status, 304);
    assert.equal(await cached.text(), '');
    const stale = await fetch(url, { headers:{ 'If-None-Match':'"old"' } });
    assert.equal(stale.status, 200);
    await stale.arrayBuffer();
    const session = await fetch(origin + '/api/session', { headers:{ 'If-None-Match':tag } });
    assert.equal(session.status, 200);
    assert.equal(session.headers.get('cache-control'), 'no-store');
    assert.equal(session.headers.get('etag'), null);
    assert.deepEqual(await session.json(), { user:null });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
