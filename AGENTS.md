# Working on RITMA

RITMA is the project folder for LUNARA, a Node.js and SQLite cycle and wellness app. Use [README.md](README.md) for setup and [the production runbook](docs/PRODUCTION_RUNBOOK.md) for deployment and recovery.

- Run `npm test` after changes to shared UI, storage, or the API. Use synthetic accounts and a temporary SQLite database. For a browser QA preview, set a separate `LUNARA_DB` and `PORT`. Record verified results in [the QA report](docs/QA_REPORT.md).
- Keep image references and alt text in the existing asset catalog.
- Preserve existing rows through numbered database migrations. Follow [the data protection instructions](docs/DATA_PROTECTION.md) for encrypted storage, keys, and backups.
- Keep databases, account exports, credentials, recovery codes, and private keys out of commits and test artifacts.
