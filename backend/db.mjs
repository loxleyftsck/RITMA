import { DatabaseSync } from 'node:sqlite';
import { encryptedConnection, isPlainDatabase } from './storage.mjs';

export function openDatabase(file, key = null) {
  if (key && isPlainDatabase(file)) throw new Error('Migrate the legacy database before starting LUNARA.');
  const db = key ? encryptedConnection(file, key) : new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 4) throw new Error('Unsupported LUNARA database version');
    if (version === 0) db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery TEXT NOT NULL,
      name TEXT NOT NULL, motion INTEGER NOT NULL DEFAULT 0, tracking TEXT NOT NULL DEFAULT 'cycle',
      consent_at TEXT, onboarding_complete INTEGER NOT NULL DEFAULT 0,
      cycle_length INTEGER, period_length INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS cycles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL, end_date TEXT, PRIMARY KEY(user_id,start_date),
      CHECK(end_date IS NULL OR end_date >= start_date)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mood_logs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL,
      mood TEXT NOT NULL, energy INTEGER, stress INTEGER, PRIMARY KEY(user_id,date)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS journal_logs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, date TEXT NOT NULL,
      note TEXT NOT NULL, PRIMARY KEY(user_id,id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS symptom_logs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, date TEXT NOT NULL,
      time TEXT NOT NULL, name TEXT NOT NULL, severity TEXT NOT NULL, PRIMARY KEY(user_id,id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sleep_logs (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL,
      minutes INTEGER NOT NULL, quality TEXT NOT NULL, PRIMARY KEY(user_id,date)
    ) STRICT;
    `);
    if (version < 2) db.exec(`
      ALTER TABLE cycles ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy'
        CHECK(source IN ('legacy','range','start-only'));
      PRAGMA user_version=2;
    `);
    if (version < 3) db.exec(`
      CREATE TABLE ai_threads (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE TABLE ai_turns (
        user_id TEXT NOT NULL REFERENCES ai_threads(user_id) ON DELETE CASCADE,
        id TEXT NOT NULL, question TEXT NOT NULL, reply TEXT NOT NULL, language TEXT NOT NULL,
        history_used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        PRIMARY KEY(user_id,id)
      ) STRICT;
      PRAGMA user_version=3;
    `);
    if (version < 4) db.exec(`
      ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
      UPDATE sessions SET last_seen=CAST(strftime('%s','now') AS INTEGER)*1000,
        expires=min(expires,CAST(strftime('%s','now') AS INTEGER)*1000+43200000);
      CREATE TABLE privacy_events (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, action TEXT NOT NULL,
        policy TEXT NOT NULL, happened_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX privacy_user_idx ON privacy_events(user_id);
      INSERT INTO privacy_events SELECT id,'granted','tracking-v1',consent_at FROM users WHERE consent_at IS NOT NULL;
      CREATE TABLE audit_events (
        happened_at TEXT NOT NULL, event TEXT NOT NULL, outcome TEXT NOT NULL, subject TEXT
      ) STRICT;
      CREATE INDEX audit_subject_idx ON audit_events(subject);
      CREATE INDEX audit_time_idx ON audit_events(happened_at);
      PRAGMA user_version=4;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
