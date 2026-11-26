# RITMA production runbook

## Deployment model

Run one Node.js 24 LTS process with one encrypted SQLite database on a persistent local volume. Node serves both the UI and the API and terminates HTTPS. The process binds to `127.0.0.1`; for a public hostname the host must forward the TCP connection to Node while preserving the HTTPS session and canonical Host header. Select and test the edge, supervisor, certificate provisioning, certificate renewal, and log collector on the actual target before launch. Use a separate restricted service account and keep the database, private keys, and offline backups outside the release directory. Current rate limits are in-process and use the direct peer address plus account-specific limits. A forwarding layer that replaces all peer addresses can cause shared throttling and must be evaluated on the target.

## Environment

The process reads environment variables supplied by the supervisor. Use [the example](../.env.production.example) as a reference. Keep actual values in the host configuration and inject secrets from its secret store.

| Variable | Production use |
| --- | --- |
| `NODE_ENV` | Set to `production`. |
| `PORT` | Local listening port, defaults to 4173. |
| `LUNARA_ORIGIN` | Exact canonical HTTPS origin with no trailing slash or path. Include an explicit nonstandard public port if used. |
| `LUNARA_DB` | Required absolute database path. Use a long-lived local filesystem with the existing database and its SQLite sidecars in the same directory. |
| `LUNARA_DB_KEY` | Required base64url encoding of 32 random bytes. Retain the original key for that database and its backups. |
| `LUNARA_TLS_CERT_FILE` | Required PEM certificate with its chain, matching the public hostname. |
| `LUNARA_TLS_KEY_FILE` | Required PEM private key readable by the service account. |
| `LUNARA_REQUEST_LOG` | `1` enables compact JSON request events and is the production default. `0` disables request events. |
| `LUNARA_AI_PROVIDER` | Optional `ollama` for local topic routing. The education library runs when unset. |
| `LUNARA_OLLAMA_PORT` and `LUNARA_OLLAMA_MODEL` | Optional local Ollama routing, defaults to 11434 and `qwen2.5:0.5b`. See [AI Care](AI_CARE.md). |

The Windows development DPAPI key is tied to its user profile. To deploy existing data encrypted with DPAPI, plan a separately authorized conversion and verify a protected copy before cutover. Assigning an unrelated environment key cannot unlock that database.

## Install and verify

1. Stage source in a fresh versioned release directory. Include `backend/`, `public/`, `src/`, `test/`, `tools/`, `index.html`, `server.mjs`, the npm manifests and the operating docs. Keep the current release available for rollback.
2. Run `npm ci` and `npm test` on the target OS. On verified Windows x64 with Node.js 24, use `npm ci --ignore-scripts` and `npm test` when the package lifecycle attempts a native rebuild without Build Tools. This uses the prebuilt binary shipped in the locked SQLite package. Other platforms should verify their supported installation path independently. [npm clean install](https://docs.npmjs.com/cli/commands/npm-ci)
3. Configure persistent storage, the stable database key, certificate chain and supervisor. For a new database, start with a new filename. For an existing database, complete the offline backup and migration procedure below before opening traffic.
4. Start with `npm start`. Under a service supervisor, `node server.mjs` runs the same entry point directly. Verify the certificate and the canonical origin with `npm run smoke -- https://your-canonical-origin`. The smoke checks query readiness, headers, shell, asset caching and a signed-out session. For an isolated private CA rehearsal, add its CA certificate to the probe process with `NODE_EXTRA_CA_CERTS`.
5. In staging, exercise sign-in, onboarding, tracking, report download, privacy controls and an AI Care message with synthetic accounts. Verify the edge observes correct client behavior under representative traffic, including authentication throttling. Inspect certificate renewal and restart behavior on that host.
6. For public release, confirm the checklist below, open traffic during a monitored window, rerun the smoke check and watch readiness, 5xx, latency and sign-in behavior during the first 15 minutes.

## Migration, backup, and rollback

Stop the service and verify that the database has no writers before maintenance. Use fresh destination filenames on restricted media. The CLI uses the configured `LUNARA_DB` and the same secret as the application.

```text
node tools/storage.mjs backup <new-snapshot>
node tools/storage.mjs verify <new-snapshot>
node tools/storage.mjs restore-copy <new-snapshot> <fresh-rehearsal-database>
node tools/storage.mjs verify <fresh-rehearsal-database>
```

For an already encrypted database, opening it with the new release runs numbered schema migrations. Save and verify an encrypted pre-upgrade snapshot, then rehearse startup against a restored copy before updating the active file. For plaintext legacy files, use the separate conversion procedure in [Data protection](DATA_PROTECTION.md). Establish backup frequency and retention from the operator's recovery objectives. Keep encrypted copies and recoverable key material in separate restricted stores. Exercise restore regularly and reconcile deletions before returning a restored snapshot to service.

Roll back the release if readiness fails repeatedly, the selected release thresholds are breached, or sign-in, isolation, or exports regress. Stop incoming writes first. If the old binary supports the active schema, check that in staging, then switch the release and verify before reopening. If it needs the old schema, preserve the failed database for reconciliation, restore the pre-upgrade backup into a fresh path, point the old release at that copy, and rerun smoke and authentication QA. A snapshot restore can lose writes made after that snapshot. Confirm data reconciliation before reopening.

## Logging and monitoring

- Probe `GET /healthz` over HTTPS using the canonical origin. It returns `200 {"status":"ok"}` when the initialized database can be queried and `503 {"status":"unavailable"}` if the query fails. It reports database readiness only and sends no private data.
- Collect JSON request events from stdout and operational errors from stderr. HTTP events contain timestamp, route group, status and duration. They omit URLs, queries, IPs, identifiers, cookies and bodies. Limit log access, retention and volume in the collector. Apply the same privacy rules to edge logs. Database audit events have their own policy in [Data protection](DATA_PROTECTION.md).
- Track readiness failures, request count, 5xx and p95 by route group, service restarts, certificate expiry, disk space, and backup age. Set alert thresholds and ownership on the target using measured traffic and recovery objectives. Keep a separate synthetic functional smoke where stricter end-to-end coverage is needed.
- Assets use short-lived public caching and weak ETags. The shell and frontend source revalidate. Authenticated API responses and export files use `no-store`. Use the performance measurements in [Release verification](RELEASE_VERIFICATION.md) as local evidence.

## Public release checklist

- [ ] Production host, edge, TLS renewal, firewall and persistent volume verified.
- [ ] Candidate installed and tested on the actual target, including concurrent load, rate limits, backup and restore.
- [ ] Monitoring, alerts, incident ownership, key custody and rollback verified.
- [ ] Public privacy notice, retention and operator review completed. Medical education and final visual assets reviewed for public use.
- [ ] Owner approves opening traffic. Post-deploy smoke and first-window monitoring recorded.
