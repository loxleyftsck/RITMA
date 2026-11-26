# RITMA Phase 11 — Release verification

**Verified** 26 November 2026 on Windows x64, Node.js 24.19.0. The production-mode rehearsal ran on loopback in a fresh source copy with separate synthetic storage and a temporary CA trusted only by the test clients.

## Rehearsal results

| Check | Result |
| --- | --- |
| Clean dependency installation | Pass with the Windows prebuild. The standard `npm ci` attempted a native rebuild and could not find Visual Studio Build Tools. `npm ci --ignore-scripts` installed 16 locked packages and the packaged SQLite binary loaded. |
| Automated tests | 27 of 27 passed in the clean copy. |
| Production startup checks | Startup rejected relative storage, missing TLS key, missing database key and a wrong database key. A new encrypted database reached schema 4. |
| HTTPS and smoke | Negotiated TLS 1.3 with certificate validation. The read-only production smoke passed on fresh, migrated and restored storage. Registration used a Secure, HttpOnly, SameSite=Strict host-only cookie. |
| Functional check | Registered a synthetic account, consented, logged a period, and exported a private CSV over HTTPS. Sign-in after restoration returned the same period. |
| Existing data | Encrypted schema 3 migrated to schema 4 while preserving a synthetic journal record and its prior consent. SQLite integrity and foreign-key checks passed. |
| Backup and restore | The shipped offline CLI created and verified an encrypted snapshot, restored it to a new path and verified the restored copy. The app started successfully from that copy. |
| Monitoring and privacy | The script checked 27 JSON HTTP events for the expected fields and absence of the test email, password, account ID, cookie, query marker and database key. The readiness response contained only service status. |
| Transfer optimization | The editorial hero returned 62,864 body bytes on uncached GET. Conditional GET returned 304 with zero body bytes. HEAD returned the expected content length with zero body bytes. This measures transfer bodies on loopback, with no claim about host latency or throughput. |
| Asset inventory | All 30 artwork files in the manifest exist. The 18-route suite checked artwork references, and Phase 10 sampled crop and rendering in Chrome. The public asset approval record remains open. |

## Final brief checklist

| Criterion | Verification |
| --- | --- |
| App runs, authentication, onboarding | Phase 10 browser and API passed. Phase 11 repeated startup and the synthetic HTTPS registration flow. |
| Cycle, mood and symptom tracking, persistence | Phase 10 browser and API passed. Phase 11 verified period data after encrypted restore. |
| Record-derived analytics and estimates | Phase 10 browser and unit checks passed with synthetic records. The UI labels current estimates and withholds estimates for unsupported history. |
| AI Care safety restrictions | Local routing, library fallback, selected urgent/medical phrase boundaries and opt-in record summaries passed scoped checks. Clinical review and comprehensive phrase coverage remain open. |
| Report exports and privacy controls | Phase 10 verified PDF/CSV in Chrome and scoped exports, consent and account deletion through the API. Phase 11 repeated the CSV check over HTTPS. |
| Generated, optimized and integrated assets | Asset inventory and 18-route references verified. The sampled visuals passed Phase 10 review. |
| Responsive mobile and desktop layouts | Chrome tests passed for sampled desktop and mobile widths. Physical devices and cross-browser checks remain open. |
| Automated tests and critical security checks | 27 tests passed locally. HTTPS, cookies, isolation, encrypted storage and protected exports have scoped local evidence. The [concurrent load follow-up](QA_REPORT.md#local-pre-release-concurrency-follow-up) verified mixed local traffic and in-flight shutdown. Edge routing, production key handling, representative load and monitoring remain target-specific checks. |
| Documentation and navigation | User, developer and operating guides are present. Phase 10 browser flows and route tests verified sampled navigation. A full manual review of all feature paths was outside the rehearsal. |

This is a local production-readiness handoff. The public release checklist in [the production runbook](PRODUCTION_RUNBOOK.md) remains open for the chosen host, operator privacy review, certificate renewal, alerts, public approval and post-deploy smoke. Cross-platform deployment and graceful stop via the target supervisor remain to be exercised. See [Phase 10 QA](QA_REPORT.md) for prior browser evidence.
