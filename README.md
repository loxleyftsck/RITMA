# RITMA / LUNARA

LUNARA is a local cycle and wellness application. RITMA is the project folder name.

The Today dashboard brings together cycle status, the next-period estimate when available, daily mood, and quick symptom and sleep logging. Ask Lumi opens AI Care with an editable question about cycle phases.

## Run locally

With Node.js 24 LTS, run `npm ci`, then `npm run dev` from this directory and open http://127.0.0.1:4173/. Run `npm test` for integration, calendar, route, export and asset checks.

On Windows x64 with Node.js 24, the pinned SQLite package ships a prebuilt Windows binary. If the package lifecycle attempts a native rebuild and Build Tools are unavailable, run `npm ci --ignore-scripts`, then `npm test` before starting the app. This installation path was verified in a fresh Windows x64 source copy.

Create an account and save the recovery code somewhere private. Local recovery uses this code and generates a new one after reset. Complete the consent and tracking setup before entering health records. Profile links to Settings, sign-out and the saved-record summary.

The app stores its data in an encrypted `data/lunara.sqlite` by default. The server binds to loopback. On Windows it can create a DPAPI-protected key for the current user. Follow the storage instructions before starting a Phase 08 database with this version.

## Phase 05

Accounts, protected sessions, tracking preferences, consent, period range history, mood and journal entries, custom symptoms, and sleep entries are connected to SQLite.

## Phase 06

Home and Cycle display a next-period start estimate only when saved history supports one. The calendar distinguishes logged and estimated dates. Insights uses real start intervals, recorded lengths and wellness summaries. See [calculation and limitations](docs/CYCLE_INTELLIGENCE.md).

## Phase 07

AI Care answers supported education questions and can include a private summary when enabled for that message. The local Ollama adapter can match questions to approved topics. The education library also runs without a model. See [provider configuration and data handling](docs/AI_CARE.md).

## Phase 08

Health Report previews a selected range and offers local PDF and UTF-8 CSV downloads. Journal notes are optional. Wellness Library includes nine searchable and sourced articles. See [report and library details](docs/HEALTH_REPORTS_AND_WELLNESS.md).

## Phase 09

Privacy & data allows account JSON export, consent withdrawal and account deletion. The server adds encrypted storage, session and rate limits, scoped audit events and an HTTPS configuration. See [data protection and backup operations](docs/DATA_PROTECTION.md).

## Production readiness

- [Production runbook](docs/PRODUCTION_RUNBOOK.md) covers configuration, install, HTTPS smoke, monitoring and rollback.
- [Release verification](docs/RELEASE_VERIFICATION.md) records the clean installation and release rehearsal.
- [User guide](docs/USER_GUIDE.md) and [developer guide](docs/DEVELOPER_GUIDE.md) cover daily use and maintenance.
