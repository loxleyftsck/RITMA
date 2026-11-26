# Local API

All requests use the local app origin. JSON write requests carry `Origin`. Tracking writes also carry `X-Lunara-Account` with the account ID from the session snapshot to prevent submitting stale state after an account switch.

| Method and path | Use |
| --- | --- |
| GET `/api/session` | Read the current account and its saved records, or receive a null user |
| POST `/api/register` | Create a local account, start its session and issue a recovery code |
| POST `/api/login` | Start a session and return the account snapshot |
| POST `/api/logout` | Revoke the current session |
| POST `/api/recover` | Reset a password using the recovery code and rotate that code |
| POST `/api/preferences` | Save name, motion preference, tracking preferences and onboarding consent |
| POST `/api/period` | Create or edit a period range with start and optional end |
| POST `/api/period/remove` | Remove a period by its saved start date |
| POST `/api/mood` | Save date-specific mood, energy and stress |
| POST `/api/journal` | Add a dated journal entry |
| POST `/api/symptom` | Add a dated and timed symptom with severity and optional custom name |
| POST `/api/sleep` | Save total minutes and quality for a sleep date |

The API returns HTTP 400 for validation failures, 401 for unavailable authentication, 403 for disallowed origins or missing tracking consent, and 409 for stale account context or duplicate registration. Record writes return the updated account snapshot. A client submission identifier de-duplicates retried journal and symptom writes. Optional tracking lengths remain unknown until provided.

Authenticated snapshots include `analysis.asOf`, historical intervals and period lengths under `analysis.cycle`, an estimate or a reason for holding it under `analysis.cycle.next`, and the trailing 30-day summaries under `analysis.wellness`. Every period entry includes a provenance value in `cycles[].source`. See [Cycle intelligence](CYCLE_INTELLIGENCE.md) for calculations and limits.

AI Care requires a signed-in, onboarded user and a matching `X-Lunara-Account`, including for reads. `GET /api/companion` returns the recent turns and thread revision. `POST /api/companion` accepts `id`, `revision`, `question`, `language` and the optional boolean `includeHistory`. `POST /api/companion/clear` clears the account's conversation and advances its revision. A stale revision returns HTTP 409. See [AI Care](AI_CARE.md) for consent and provider details.

`POST /api/report/export` accepts `from` and `to` as inclusive ISO dates, `format` as `pdf` or `csv`, and optional boolean `includeNotes`. It requires tracking setup, an active session, matching account header and same-origin JSON. It returns a no-store attachment. See [Health Report](HEALTH_REPORTS_AND_WELLNESS.md) for scope and formatting.

Privacy operations require same-origin JSON, an active session and the matching account header.

| Method and path | Body and result |
| --- | --- |
| POST `/api/privacy/consent` | `granted` boolean. Returns the current snapshot. `analysis` is null while consent is paused. |
| POST `/api/privacy/export` | Current `password`. Returns a private JSON attachment with the account's user data. |
| POST `/api/privacy/delete` | Current `password` and `confirmation` with exact value `DELETE`. Revokes the session and returns a null user. |

Throttled operations return 429 with `Retry-After`. See [data protection](DATA_PROTECTION.md).
