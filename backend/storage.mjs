import { spawnSync } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  closeSync, constants, copyFileSync, existsSync, openSync, readFileSync, readSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';

const sqliteHeader = Buffer.from('SQLite format 3\0');
const dpapiScript = method => `
  $ErrorActionPreference = 'Stop'
  Add-Type -AssemblyName System.Security
  $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
  $value = [Security.Cryptography.ProtectedData]::${method}($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Write([Convert]::ToBase64String($value))
`;

export function isPlainDatabase(file) {
  if (!existsSync(file)) return false;
  const descriptor = openSync(file, 'r');
  try {
    const header = Buffer.alloc(sqliteHeader.length);
    return readSync(descriptor, header, 0, header.length, 0) === header.length && timingSafeEqual(header, sqliteHeader);
  } finally {
    closeSync(descriptor);
  }
}

function dpapi(method, bytes) {
  const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const child = spawnSync(executable, ['-NoProfile','-NonInteractive','-Command',dpapiScript(method)], {
    input:bytes.toString('base64'), encoding:'utf8', windowsHide:true, timeout:10_000,
  });
  if (child.status !== 0 || !child.stdout?.trim()) throw new Error('Windows key protection is unavailable for this account.');
  return Buffer.from(child.stdout.trim(), 'base64');
}

function validatedKey(bytes) {
  if (bytes.length !== 32) throw new Error('The database key must contain exactly 32 bytes.');
  return bytes;
}

export function loadDatabaseKey(file, { allowLegacy = false, env = process.env } = {}) {
  if (env.LUNARA_DB_KEY) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(env.LUNARA_DB_KEY)) throw new Error('LUNARA_DB_KEY must be a 32-byte base64url secret.');
    return validatedKey(Buffer.from(env.LUNARA_DB_KEY, 'base64url'));
  }
  if (env.NODE_ENV === 'production' || process.platform !== 'win32') {
    throw new Error('Set LUNARA_DB_KEY from your secret store.');
  }
  const keyFile = file + '.key.dpapi';
  if (existsSync(keyFile)) return validatedKey(dpapi('Unprotect', readFileSync(keyFile)));
  if (existsSync(file) && !(allowLegacy && isPlainDatabase(file))) {
    throw new Error('The database key is missing. Restore the original key or run the documented legacy migration.');
  }
  const bytes = randomBytes(32);
  writeFileSync(keyFile, dpapi('Protect', bytes), { flag:'wx', mode:0o600 });
  return bytes;
}

export function encryptedConnection(file, key, options = {}) {
  const db = new Database(file, options);
  try {
    db.pragma("cipher='chacha20'");
    db.key(validatedKey(key));
    db.prepare('SELECT name FROM sqlite_schema LIMIT 1').get();
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function inspectEncrypted(file, key) {
  if (statSync(file).size < 512) throw new Error('The database file is incomplete.');
  if (isPlainDatabase(file)) throw new Error('A plaintext database was found. Migrate it before starting LUNARA.');
  const db = encryptedConnection(file, key, { readonly:true, fileMustExist:true });
  try {
    if (db.pragma('quick_check', { simple:true }) !== 'ok') throw new Error('Database integrity check failed.');
    return db.pragma('user_version', { simple:true });
  } finally {
    db.close();
  }
}

export function encryptLegacy(file, key) {
  if (!isPlainDatabase(file)) return inspectEncrypted(file, key);
  const db = new Database(file, { fileMustExist:true });
  try {
    if (db.pragma('quick_check', { simple:true }) !== 'ok') throw new Error('Legacy database integrity check failed.');
    db.pragma('wal_checkpoint(TRUNCATE)');
    if (db.pragma('journal_mode=DELETE', { simple:true }) !== 'delete') throw new Error('Stop the active server before converting the database.');
    db.pragma("cipher='chacha20'");
    db.rekey(validatedKey(key));
    db.pragma('secure_delete=ON');
    db.exec('VACUUM');
  } finally {
    db.close();
  }
  return inspectEncrypted(file, key);
}

export function backupEncrypted(source, destination, key) {
  if (isPlainDatabase(source)) throw new Error('Migrate before creating an encrypted backup.');
  const db = encryptedConnection(source, key, { fileMustExist:true });
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    if (db.pragma('journal_mode=DELETE', { simple:true }) !== 'delete') throw new Error('Stop the active server before backing up.');
    db.exec('BEGIN EXCLUSIVE');
    try {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    } finally {
      db.exec('ROLLBACK');
    }
  } finally {
    db.close();
  }
  return inspectEncrypted(destination, key);
}

export function backupLegacy(source, destination, key) {
  if (!isPlainDatabase(source)) throw new Error('Legacy backup expects a plaintext source.');
  const db = new Database(source, { fileMustExist:true });
  let copied = false;
  try {
    if (db.pragma('quick_check', { simple:true }) !== 'ok') throw new Error('Legacy database integrity check failed.');
    db.pragma('wal_checkpoint(TRUNCATE)');
    if (db.pragma('journal_mode=DELETE', { simple:true }) !== 'delete') throw new Error('Stop the server before backing up.');
    db.exec('BEGIN EXCLUSIVE');
    try {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
      copied = true;
      return encryptLegacy(destination, key);
    } catch (error) {
      if (copied) unlinkSync(destination);
      throw error;
    } finally {
      db.exec('ROLLBACK');
    }
  } finally {
    db.close();
  }
}
