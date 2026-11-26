# RITMA Phase 10 — Quality Assurance

**Date** 26 November 2026  
**Build** RITMA 0.9.0 with Phase 10 fixes  
**Environment** Windows, Node.js 24.19.0 and Chrome. Functional QA used a separate loopback server, an encrypted test database and synthetic accounts. The performance samples used the same local server.

## Functional QA

| Area | Result | Evidence |
| --- | --- | --- |
| Authentication | Pass | Chrome registration showed the recovery-code dialog. Sign-out, incorrect-password feedback, valid sign-in and reload were exercised. Rotation and session revocation passed in the API integration suite. |
| Onboarding | Pass | All four introduction screens opened. The browser blocked submission without tracking consent. Choosing both tracking modes and giving consent led to the dashboard. |
| Cycle tracking | Pass | Empty history rendered. Chrome showed an alert for a reversed date range and saved the corrected range. Logged history appeared. Four regular synthetic periods produced a 28-day median and an estimate through the API. |
| Mood logging | Pass | Saving Calm selected the mood in Home, displayed it in Insights, and preserved it after signing in and reloading. |
| Symptom logging | Pass | Empty state appeared before logging. Chrome saved a Moderate Headache, and Insights counted one entry on one day. |
| Analytics | Pass | Chrome totals matched the mood and symptom fixture. Unit tests cover unsupported estimates, date boundaries, variable intervals and recorded durations. |
| AI Care | Fixed and retested | The original English phase question returned a generic tracking reply from the local model routing flow. The revised reply explained the phases in Chrome and linked its source. Both English and Indonesian passed the HTTP retest. The education library supplied both replies when the local model proposed a different topic. [Office on Women’s Health](https://womenshealth.gov/pregnancy/menstrual-cycle) |
| Report export | Pass | Chrome previewed 1–26 November and downloaded a readable one-page PDF and a UTF-8 CSV. The downloaded files included the recorded period, Calm mood and Headache in their expected formats. API checks confirmed opt-in journal inclusion, account boundaries and private cache policy. |

## UI and accessibility QA

| Area | Result | Evidence |
| --- | --- | --- |
| Typography, spacing, alignment and color | Pass in reviewed views | Visually reviewed Home with its sidebar at 1300 × 875 and stacked with bottom navigation at 390 × 850. Report controls fit both widths. |
| Artwork | Pass in reviewed views | The Home hero crop retained the subject at desktop and mobile widths. The four Cycle images loaded after scrolling. The route test resolved the artwork used by all 18 routes. |
| Responsive layout | Pass in tested views | No document overrun or off-screen sampled controls at 390 px on Home, Cycle, Insights, AI Care, Profile and Report. At 320 px, Cycle and its period dialog fit the viewport. Its five bottom navigation targets measured about 57 × 48 px. |
| Empty and error states | Pass in tested views | Period and symptom empty states, reversed-period error and incorrect-password error appeared in Chrome. |
| Control boundaries | Fixed and retested | The shared control border was 2.46:1 on white. The updated border is 3.92:1 on white, 3.77:1 on canvas and 3.45:1 on faint pink. Chrome confirmed the computed color on both visible period inputs. [W3C WCAG 2.1 SC 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) |
| Keyboard and semantics | Pass in sampled flow | Enter opened the period dialog, Escape closed it and restored focus to Log period. Both visible date fields had labels. The accessibility tree showed landmarks, named controls and the form error. |

## Technical and security QA

- **26 of 26 automated tests passed.** These cover unit logic, integration flows, schema migrations, encrypted backup and restore, authorization, report attachments and route rendering.
- **79 of 79 HTTP status checks passed** in a separate black-box run against the encrypted QA instance. Additional assertions checked content, forecast behavior, private cache directives, response headers, account isolation and two-language AI replies. Invalid dates, unauthenticated writes, writes from another origin and mismatched accounts returned 400, 401, 403 and 409 respectively.
- The synthetic database passed SQLite `quick_check` and `foreign_key_check` on schema 4. Automated tests separately verified rejection of an incorrect encryption key.
- Session cookie attributes, expiry and revocation passed the scoped tests. Private export required the current password. The peer account started with empty tracking data and its report contained none of the owner's journal text. The static server returned 404 for the database, Windows key file, environment file, server source and dependency lockfile. CSP, content-type sniffing protection and referrer policy were present. The tested Ollama path used loopback and no provider API key.

## Local performance samples

| Request | Samples | Median | p95 | Response |
| --- | ---: | ---: | ---: | ---: |
| HTML shell | 20 | 14.9 ms | 17.8 ms | 795 B |
| Signed-in session snapshot | 20 | 14.6 ms | 17.7 ms | 1,290 B |
| Small PDF export | 8 | 25.0 ms | 35.0 ms | 9,912 B |

Samples were sequential and include reading response bodies. The two phase questions took 2,869 ms and 326 ms respectively, including a local routing attempt. These measurements describe this single machine and small fixture.

## Remaining verification

Real mobile devices, Safari/Firefox, manual screen-reader use, 200% browser zoom, sustained concurrent load, a hosted production environment, and operator-controlled secret storage were outside this local run. Model response quality across the full education catalogue and the clinical review of its content remain unverified. The next planned phase is **Phase 11 — Production Readiness**.

## Local pre-release concurrency follow-up

Run `npm run load-check` for an eight-round burst or `npm run load-check -- --paced` for twelve rounds spaced 2.5 seconds apart. The tool starts an isolated HTTP loopback server and uses twelve synthetic accounts and a temporary encrypted SQLite database. It measures completed responses including body transfer. Account registration and onboarding run before the timed portion.

The paced profile completed **576 requests in 27.69 seconds** on Windows with Node.js 24.19.0. Each round checked readiness, saved a journal entry, compared the signed-in snapshot and generated either a CSV or a PDF for each account.

| Operation | Samples | Median | p95 |
| --- | ---: | ---: | ---: |
| Readiness | 144 | 8.3 ms | 24.4 ms |
| Journal write | 144 | 12.5 ms | 21.4 ms |
| Session snapshot | 144 | 8.2 ms | 12.8 ms |
| CSV export | 72 | 10.7 ms | 14.3 ms |
| PDF export | 72 | 154.4 ms | 241.6 ms |

All 144 journal entries persisted. Each of the 72 CSVs contained the owner's current entry and no marker from another account. The 72 PDF responses had valid PDF signatures. SQLite integrity and foreign-key checks passed. A paused AI Care request, using a controlled local test router, finished and persisted its reply after application-level shutdown started.

This run measured a short, paced workload on a single host. The deployment edge, long-running representative traffic, and the target service supervisor's shutdown behavior remain to be verified.

## Mobile visual refresh

Reviewed in Chrome with a separate synthetic account at 320 and 390 CSS pixels and sampled the desktop Dashboard at 1300 CSS pixels. Checked the full-bleed welcome art, onboarding, dashboard cycle dial, calendar, mood choices, insights, AI Care conversation, report summary, wellness search, and profile. The sampled signed-in main screens showed no horizontal page overflow at 320 px. Onboarding at 320 × 750 CSS pixels had an 86 px gap between the header actions and a visible 46 px Continue button.

Signed in, opened and closed the period dialog with the keyboard, saved a mood, loaded a prior AI Care response, searched the library, and exercised CSV and PDF export feedback. The new Export report shortcut moved keyboard focus to the report start date. These checks used Chrome viewport emulation. Physical devices and native packaging remain separate work.

## Mobile visual polish

- **Icon and Dashboard review.** Inspected six new SVGs and five navigation glyphs at their intended sizes. Revised Tender's expression after the first sheet review. On the synthetic Dashboard at 390 × 850 CSS px, all five mood images loaded and the check-in row ended at y=641, above the tab bar at y=790. The ring showed day 18 from saved starts, and the next date retained its Estimate badge. [Icon review sheet](MOBILE_ICON_REVIEW.png)
- **Responsive review.** At 320 CSS px, Dashboard, Cycle, Mood, Insights, AI Care, Profile, Report and Library showed no horizontal page overflow. Sampled tab items were 48 px high. Onboarding displayed four status dots and its Continue button fit in a 320 × 750 px viewport. Desktop Dashboard used the side navigation at 1300 px with no page overflow.
- **Flow checks.** Signed in, changed calendar month to see labeled estimated dates, rejected a reversed period range, and saved the corrected range. Saved a mood from Home and verified its selected state in Mood Tracker. Used an AI suggestion, checked that the new cited reply took focus, and generated CSV and PDF through the report screen. Confirmed the featured Library card appears in the unfiltered list and search narrows to matching articles.
- **State checks.** Withdrew consent on the synthetic account, verified the Dashboard removed its estimate and disabled all five quick check-in controls, and confirmed previously saved mood history remained accessible. Resumed consent through the existing confirmation flow. Screen regression tests cover the empty Dashboard, the empty AI conversation, and the AI error alert.
- Existing portrait and botanical artwork remained legible in the reviewed layouts. No extra raster assets were required. Verification used Chrome viewport emulation, with physical device testing still open.

## Ritme Harian artwork and interaction

- Verified six transparent WebP files, including a clear center for the chiffon orbit and distinct mood expressions at tile and portrait sizes. Together they use 129,852 bytes. The Dashboard at 390 px loaded the orbit and all five mood tiles, with no horizontal page overflow.
- Confirmed that pointer and keyboard selection save a mood and update the selected button and the large portrait in the browser. Selection runs a 320 ms easing after the server confirms the save. Buttons use a short press transform when motion is allowed.
- With app reduced motion enabled, the portrait changed and selection persisted after reload without an animated transform. Mood Tracker at 320 px had no horizontal page overflow. The stylesheet and selection handler also check the browser's reduced-motion preference.
- Verified 29 automated tests. The interaction check used Chrome emulation and a synthetic account in the isolated preview.

## Approved local typography

Installed Literata for display headings and large figures, and Be Vietnam Pro for interface text. Verified all four bundled WOFF2 faces in Chrome, including Semibold on the report form. Welcome at 390 px and Dashboard, Cycle, Mood, Profile, and Report at 320 px had no horizontal page overflow. The sampled mobile navigation labels fit their tabs. The HTTP regression verifies local font MIME types and same-origin font policy. The full suite has 29 passing tests.

## Micro-interactions

- At 390 px in Chrome, keyboard month navigation revealed the grid from +10 px for Next and −10 px for Previous. Focus remained on the activated month control. With app reduced motion enabled, the month changed with no transform.
- Confirmed the onboarding illustration moves on Continue and Previous returns to the earlier step. Press feedback also covers the primary mobile tabs and the estimate card.
- Observed the save toast starting 6 px below its resting position after a successful mood save. A new AI Care reply appeared and started 8 px below its resting position. Focus moved to that reply after it arrived.
- Motion skips when reduced motion is enabled in the app or requested by the browser. The same motion guard is shared with the existing mood-portrait animation.
- All 29 automated tests passed. The browser checks used the isolated synthetic preview.

## Energy and Stress choices

Energy uses sage green and Stress uses the existing mauve on the label and scale. A solid fill, white inset ring, and bold number mark the selected value. The four selected and unselected numeric text pairs have contrast ratios from 6.37:1 to 7.84:1. In the isolated Chrome preview, pointer selection and keyboard focus worked at 320 px, and both values and their colors persisted after saving and reloading at 390 px. Neither viewport had horizontal overflow or console errors.

Reviewed the tap-to-select and explicit-save patterns documented by [Clue](https://support.helloclue.com/hc/en-us/articles/214408646-How-do-I-track-cycle-related-experiences) and [Flo](https://help.flo.health/hc/en-us/articles/4406826542740-Logging-your-symptoms). LUNARA uses two native single-choice groups with values 1–5, visible Low and High ends, and an optional Not logged choice.

In the isolated Chrome preview, both saved values initially populated their groups. Tapped Energy 5, selected Stress 1 with the keyboard, saved, and verified both values after reload. Selecting Not logged for Energy cleared only Energy and preserved Stress 1. At 320 and 390 px, the two five-column rows fit without horizontal page overflow. At 320 px, the press area was approximately 44 × 44 CSS px. The browser did not render any number inputs in the check-in form. The full suite has 30 passing tests.

## Lumi chat

- Verified the 384 × 384 transparent WebP in the empty-state portrait and the repeated assistant avatar. The file is 17,694 bytes.
- In the isolated browser preview at 390 px, a suggested question filled the composer. Shift+Enter inserted a newline, and Enter showed the pending message and disabled Send until the answer arrived. The reply showed a successful local Ollama topic match and a reviewed source.
- At 320 px, verified source expansion, Indonesian replies, explicit saved-record inclusion, and reset of the history checkbox after sending. Focus moved to the latest answer. Both turns persisted through reload, and canceling Clear chat preserved the history. Neither viewport had horizontal overflow or console errors.
- The automated suite covers rendering the mascot, escaping pending text, consent, authorization, local topic routing, and clearing a pending conversation. All 30 tests passed.

## Lumi interaction GIFs

- Validated all frames for transparency and duration. Both GIFs play once. The 256 × 256 wave has 12 frames over 1.10 seconds. The 160 × 160 thinking animation has 11 frames over 1.43 seconds.
- At 390 px in the isolated browser preview, clicking Lumi loaded and decoded the wave GIF. Pressing Enter replayed it, and the static portrait returned automatically. Sending a message loaded the thinking GIF while the pending state was visible.
- At 320 px with Reduce interface motion enabled, both interactions kept the static portrait. Greeting feedback and the pending message remained available. No horizontal overflow or console errors appeared. Both GIFs passed the server MIME checks and all 30 automated tests passed.

## RITMA Today dashboard

- Verified an empty synthetic account and one with four period starts at 390 × 844 CSS pixels. Both showed the cycle card and mood choices above the bottom navigation. The first account offered Log first period. The second showed the estimated date range and its label, plus opted-in Energy and Stress entries.
- Saved a first period, a mood, a symptom, and 7 h 35 min of sleep using the Home controls. The dashboard updated its summaries after each save. Ask Lumi opened AI Care with the suggested question filled in for review.
- Confirmed the populated layout at 320 × 760 CSS pixels without horizontal overflow. Viewing the full mood row at this size required scrolling. No console errors were observed. All 31 automated tests passed, including the paused-consent dashboard state.
- On Windows x64, the documented lockfile install with `npm ci --ignore-scripts` successfully loaded the prebuilt SQLite package and passed an in-memory query. The default lifecycle tried to fall back to a native build and requires Visual Studio C++ tools on this machine.
