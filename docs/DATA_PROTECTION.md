# Phase 09 data protection

## Account and consent

Profile and Settings open **Privacy & data**. An account owner can withdraw or resume consent, download a JSON copy after confirming their password, or delete the account after entering their password and typing DELETE. Withdrawal pauses new tracking entries, calculated insights, and new AI Care messages. Existing entries and chats remain available to their owner, who can export or delete them. Including a saved-record summary in an AI Care message still needs a separate opt-in for that message. The export includes profile, tracking records, saved chats, and consent history. Store downloaded copies privately.

Deletion revokes the account's sessions and removes its active profile, records, chats, consent events, and account-linked audit events. An existing backup or downloaded copy has its own lifetime. Reconcile deletion requests before a restored backup accepts traffic. Access is scoped to the account owner. Requests that modify records require the app's origin and, for account operations, a matching account identifier. Scrypt protects passwords, previous hashes upgrade on a successful sign-in, and recovery rotates its code and revokes prior sessions. Session cookies are HttpOnly and SameSite=Strict, with 30 minutes of inactivity and a 12-hour maximum. Sign-in, registration, recovery and sensitive account actions have in-process limits. Deployment with multiple instances would need shared rate limiting.

## Storage and operations

The persistent server uses SQLite3MultipleCiphers with ChaCha20, keyed by 32 random bytes. The local Windows installation protects the generated key with DPAPI CurrentUser in `data/lunara.sqlite.key.dpapi`. Keep the encrypted database and protected key available to that Windows user. If a deployment must recover independently of that user, configure `LUNARA_DB_KEY` with a stable 32-byte base64url value supplied by a secret manager, and back up the key separately with restricted access. Do not change the value for a database without a coordinated rekey and restore test. Startup fails if an existing file cannot be opened with its key.

The CLI uses the live database location to resolve its key. Stop the app before maintenance and use fresh destinations. Run the following from the project folder.

```powershell
node tools/storage.mjs backup data/backups/snapshot-001.sqlite
node tools/storage.mjs verify data/backups/snapshot-001.sqlite
node tools/storage.mjs restore-copy data/backups/snapshot-001.sqlite data/rehearsal/snapshot-001.sqlite
node tools/storage.mjs verify data/rehearsal/snapshot-001.sqlite
```

To convert a Phase 08 installation, stop its server and run `backup-legacy <new-destination>` first. The command stages a temporary plaintext copy during conversion, so run it on a private, encrypted volume. Run `migrate <live-path> <existing-managed-backups...>` and verify all encrypted files before restarting. The next server startup upgrades the active schema to v4. File conversion does not erase older off-device copies or recoverable remnants of previously unencrypted files. Verify the Windows volume protection and recovery media before using real health data.

The preview binds to loopback. To run in HTTPS mode, set `LUNARA_ORIGIN` to the exact HTTPS origin and supply `LUNARA_TLS_CERT_FILE` and `LUNARA_TLS_KEY_FILE` with restricted file permissions. Production mode requires all three, enforces TLS 1.2 or higher, and issues a Secure host-only session cookie with the `__Host-` prefix. Configure certificate renewal, access controls, and backup scheduling at deployment. Source files and health data are outside the static file allowlist.

Audit events cover selected authentication and privacy actions and use a hashed account ID where needed. Stored fields are action, result and timestamp with an optional hashed account ID. No email, raw tokens, journal entries or AI messages are stored in the audit table. Entries older than 90 days are pruned when audit activity resumes. Operating a deployed instance also requires a retention schedule, backup expiry, log monitoring and incident response.

## Indonesia PDP review

Health data is identified as specific personal data in Article 4 of Indonesia's Law No. 27 of 2022. The app supports access and portability workflows (Articles 7 and 13), consent withdrawal (Articles 9 and 40) and deletion (Articles 8 and 43–44). Before real-data use, the operator must establish the controller identity, processing notice, applicable legal basis, retention and deletion procedures, and a way to handle requests that the app cannot resolve. Review the high-risk processing assessment under Article 34 and the breach notification procedure under Article 46, including the 3 × 24-hour deadline where applicable. [Official law and text](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022?id=fnb)

Implementation references. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [SQLite3MultipleCiphers rekey](https://utelle.github.io/SQLite3MultipleCiphers/docs/features/feat_rekey/), [Windows DPAPI protection scope](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope)
