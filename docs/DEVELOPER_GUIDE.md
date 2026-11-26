# RITMA developer guide

Use Node.js 24 LTS and the npm lockfile. Start from [README](../README.md), follow [AGENTS.md](../AGENTS.md), and run `npm test`.

| Path | Responsibility |
| --- | --- |
| `src/` | Browser entry, route screens, shared UI and styling |
| `backend/` | Account and tracking API, SQLite migrations, encryption, report generation and AI Care |
| `public/assets/` | Local artwork and asset catalog |
| `test/` | Node test runner for logic, HTTP integration, routing and encrypted storage |
| `tools/` | Encrypted maintenance commands, HTTPS smoke and local load check |

For isolated Windows QA, open a new terminal and choose a free port and a fresh path. The directory will be created on startup.

```powershell
$env:PORT = '4181'
$env:LUNARA_DB = Join-Path $env:TEMP "ritma-qa-$([guid]::NewGuid())\lunara.sqlite"
npm run dev
```

Open the URL printed in the terminal and use a synthetic account. Close the server before removing its test files. On hosts without DPAPI, supply a disposable 32-byte base64url test key through `LUNARA_DB_KEY`. Keep fixture keys and databases outside the project.

Run `npm run load-check` for a short concurrent burst or `npm run load-check -- --paced` for a roughly 30-second sample. The command starts its own loopback server on an OS-assigned port, uses a disposable encrypted database, and removes the fixture files at exit. It does not accept a target URL. Results include request timings, report isolation, integrity and one in-flight request during shutdown.

For an API change, check input validation, same-origin writes, account scope and private cache handling. Keep schema changes numbered and preserve earlier rows. Rehearse storage changes on a copy before any migration. For a UI change, verify the normal navigation path, error and empty states, keyboard focus, and mobile and desktop layout.

Use [Architecture](ARCHITECTURE.md), [API](CORE_API.md), [Data protection](DATA_PROTECTION.md) and [QA evidence](QA_REPORT.md) for component details. Use [the production runbook](PRODUCTION_RUNBOOK.md) for release operations.
