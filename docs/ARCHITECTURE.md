# RITMA architecture

## Frontend

Node serves the static frontend and JSON API from one loopback origin. Hash routing supports links without a server rewrite. Route templates live in `src/screens.js`, shared controls in `src/components.js`, and event handling and session snapshots in `src/app.js`. The app hydrates its account state from the server after reload. The Phase 03 catalog supplies image paths, sizes, alt text and focal points.

## Local data

The API in `backend/api.mjs` uses the versioned SQLite schema in `backend/db.mjs`. Parameterized queries scope reads and writes to the authenticated user. The server derives password hashes using scrypt with random salts. Session tokens and recovery codes are stored as hashes. Local session cookies are HttpOnly and SameSite=Strict. Password recovery invalidates prior sessions and issues a replacement recovery code. Requests that write data must originate from the app and match the account used to render the form.

The app persists onboarding consent separately from the decision to track either cycle or wellness. Period dates and wellness entries stay separate from calculated summaries. The pure module `backend/cycle-intelligence.mjs` calculates Phase 06 analysis from the authenticated account snapshot. Forecasts need no stored prediction rows and recalculate on data writes or session reload.

Phase 07 adds account-scoped conversation turns and per-turn summary consent. AI Care builds educational replies from its sourced library. The provider in `backend/companion.mjs` uses a loopback-only Ollama API for topic routing. User history is summarized by the app when allowed per message. Phase 09 upgrades to SQLite schema 4 for session expiry, consent history and minimal audit events. `backend/storage.mjs` handles encrypted SQLite and `backend/security.mjs` handles HTTPS configuration, request origin, security headers and rate limiting. See [data protection](DATA_PROTECTION.md).

Phase 08 shares report filtering and table conventions in `src/report-data.js`. The private export API uses the authorized account snapshot and fetches journal entries only when requested. `backend/report-export.mjs` creates PDF and CSV buffers in memory, using pinned libraries and packaged fonts. The Wellness Library serves static local article content with references in `src/wellness-data.js`. Schema 3 continues to be used.
