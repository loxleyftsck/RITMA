import { readFile } from 'node:fs/promises';

export function hostAllowed(host, origin) {
  return origin ? host === new URL(origin).host : /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host ?? '');
}

export function requestOriginAllowed(request, origin) {
  const host = request.headers.host;
  return request.headers['sec-fetch-site'] !== 'cross-site' && hostAllowed(host, origin) &&
    request.headers.origin === (origin ?? `http://${host}`);
}

export function protectResponse(response, secure) {
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

export async function transportConfiguration(env = process.env) {
  const { LUNARA_ORIGIN, LUNARA_TLS_CERT_FILE, LUNARA_TLS_KEY_FILE } = env;
  if (!LUNARA_ORIGIN && !LUNARA_TLS_CERT_FILE && !LUNARA_TLS_KEY_FILE && env.NODE_ENV !== 'production') return {};
  if (!LUNARA_ORIGIN || !LUNARA_TLS_CERT_FILE || !LUNARA_TLS_KEY_FILE) {
    throw new Error('HTTPS requires the canonical origin and both TLS files.');
  }
  const origin = new URL(LUNARA_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== LUNARA_ORIGIN) throw new Error('LUNARA_ORIGIN must be a canonical HTTPS origin.');
  const [cert, key] = await Promise.all([readFile(LUNARA_TLS_CERT_FILE), readFile(LUNARA_TLS_KEY_FILE)]);
  return { origin:origin.origin, tls:{ cert, key, minVersion:'TLSv1.2' } };
}

export function rateLimiter(now) {
  const windows = new Map();
  let pruneAfter = 0;
  return (key, limit, duration) => {
    const current = now();
    if (current >= pruneAfter) {
      for (const [id, bucket] of windows) if (bucket.until <= current) windows.delete(id);
      pruneAfter = current + 60_000;
    }
    let bucket = windows.get(key);
    if (!bucket || bucket.until <= current) {
      if (windows.size >= 16384 && !bucket) return false;
      bucket = { until:current + duration, count:0 };
      windows.set(key, bucket);
    }
    return ++bucket.count <= limit;
  };
}
