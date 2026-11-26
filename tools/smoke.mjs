import assert from 'node:assert/strict';

const origin = process.argv[2];
if (!origin || !origin.startsWith('https://') || new URL(origin).origin !== origin) {
  throw new Error('Usage: npm run smoke -- https://your-canonical-origin');
}

async function probe(path, expectedStatus, options) {
  const response = await fetch(origin + path, {
    redirect:'error', signal:AbortSignal.timeout(10_000), ...options,
  });
  assert.equal(response.status, expectedStatus, path);
  return response;
}

const health = await probe('/healthz', 200);
assert.equal(health.headers.get('cache-control'), 'no-store');
assert.deepEqual(await health.json(), { status:'ok' });
const shell = await probe('/', 200);
assert.match(shell.headers.get('strict-transport-security') ?? '', /\bmax-age=[1-9]\d*/);
assert.match(shell.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
assert.match(await shell.text(), /<title>LUNARA<\/title>/);
const asset = '/assets/brand/logo-primary.svg';
const artwork = await probe(asset, 200, { method:'HEAD' });
const tag = artwork.headers.get('etag');
assert.ok(tag);
assert.ok(Number(artwork.headers.get('content-length')) > 0);
const cached = await probe(asset, 304, { headers:{ 'If-None-Match':tag } });
assert.equal(await cached.text(), '');
const session = await probe('/api/session', 200);
assert.equal(session.headers.get('cache-control'), 'no-store');
assert.deepEqual(await session.json(), { user:null });
console.log('HTTPS, readiness, app shell, static revalidation, and signed-out session passed.');
