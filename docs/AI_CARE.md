# Phase 07 AI Care

## How answers are produced

AI Care accepts free-text questions and follow-ups in English or Indonesian. A local Ollama adapter can match the typed message to one topic from a fixed vocabulary. The application supplies the answer from its education library. The provider returns a JSON topic only, and LUNARA validates the result. A conflicting, invalid, unavailable or timed-out model result falls back to the local library. The same library can run on its own.

Before model routing, the application checks for selected urgent signals and requests for individual diagnosis, pregnancy assessment or medication. These matches take a dedicated response path and bypass the model. The checks are pattern-based and cover selected phrases. They do not provide clinical triage or guarantee coverage of every emergency.

Supported topics include cycle timing, estimates, symptom logging, mood check-ins, sleep, saved-record summaries and visit preparation. Common follow-ups can use the last education topic. User-visible clinical education and escalation links point to reviewed sources.

## Consent and storage

The form’s optional saved-record checkbox is cleared after each message. When selected, Node builds a limited summary of period counts and intervals plus recent wellness metrics for the authorized account. The model receives only the current typed question and fixed routing instructions. The app sends no saved history, journal text, account identifiers or previous conversation turns to the model.

The active encrypted SQLite database stores the question, answer, language, date and whether a saved-record summary was included. The UI shows the latest 40 exchanges. Clearing the conversation removes all saved exchanges for that account from the active database, including attached summaries. Clearing invalidates in-flight turns. Older backup files have separate retention. Withdrawing tracking consent also pauses new messages and invalidates replies that are still generating. See [storage and consent](DATA_PROTECTION.md).

## Local provider configuration

The installed preview runs a dedicated Ollama process with cloud features disabled. It uses the already cached `qwen2.5:0.5b` model on loopback port `11435`.

For a manual start, begin a local-only Ollama server with the model installed. Set `LUNARA_AI_PROVIDER=ollama`, `LUNARA_OLLAMA_PORT` to its port and `LUNARA_OLLAMA_MODEL` to the local model name before running `npm run dev`. Launching the app without the provider setting uses the education library. Configure Ollama with `OLLAMA_NO_CLOUD=1` and a loopback bind. URL redirects are blocked and remote model endpoints are outside this adapter.

## Sources

- [Ollama chat API and structured responses](https://docs.ollama.com/api/chat)
- [MedlinePlus on menstruation](https://medlineplus.gov/menstruation.html)
- [MedlinePlus on period pain](https://medlineplus.gov/periodpain.html)
- [MedlinePlus on sleep habits](https://medlineplus.gov/ency/patientinstructions/000757.htm)
- [ACOG on abnormal uterine bleeding](https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding)
- [CDC urgent maternal warning signs](https://www.cdc.gov/hearher/maternal-warning-signs/index.html)
- [BMJ study on variability in timing of the fertile window](https://www.bmj.com/content/321/7271/1259)
