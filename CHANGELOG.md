# Changelog

## Unreleased

- Documented clean installation, production configuration, backup, restore and rollback.
- Added database readiness, an HTTPS smoke command and request logging with limited metadata.
- Added static ETag revalidation and HEAD responses without loading the file body.

## 0.9.0

- Added Privacy & data for consent, password-confirmed JSON export, and account deletion.
- Added SQLite schema 4, encrypted database and backup tooling, and minimal audit events.
- Strengthened password hashes, enforced session expiry, and added throttling and HTTPS configuration.

## 0.8.0

- Added date-filtered report previews, PDF and CSV attachments, and optional personal journal notes.
- Expanded Wellness Library into nine searchable articles with direct links and sources.
- Locked the PDF and font dependencies while keeping the existing SQLite schema.

## 0.7.0

- Added an education chat in English and Indonesian with optional local model routing and sourced replies.
- Added per-message history consent, local account-scoped persistence, and conversation clear.
- Added dedicated safety responses and SQLite migration 3 for conversation history.

## 0.6.0

- Added the history-based next-start estimate with an explanatory window and hold states.
- Replaced example data in Insights with observed intervals and summaries of saved wellness logs.
- Added period date provenance and preserved existing records through SQLite migration 2.

## 0.5.0

- Added local SQLite accounts, persistent sessions, sign-out and one-time-code password recovery.
- Added protected onboarding and persisted preferences, consent, period ranges, mood, energy and stress, journal, custom symptoms and sleep logs.
- Added per-account health record summaries and integration coverage for persistence, isolation and session revocation.

## 0.4.0

- Added the Phase 04 frontend with 15 screens, session-only demo forms, responsive navigation and original LUNARA artwork.
- Added the Node.js preview server and route, calendar and server tests.
