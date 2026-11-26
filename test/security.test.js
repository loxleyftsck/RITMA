import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { openDatabase } from '../backend/db.mjs';
import { backupEncrypted, backupLegacy, encryptLegacy, encryptedConnection, inspectEncrypted, isPlainDatabase } from '../backend/storage.mjs';
import { transportConfiguration } from '../backend/security.mjs';

test('existing databases convert to encrypted storage and verified backups restore with the original key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lunara-cipher-'));
  const live = join(directory,'data.sqlite');
  const backup = join(directory,'backup.sqlite');
  const before = join(directory,'before.sqlite');
  const restore = join(directory,'restore.sqlite');
  const key = randomBytes(32);
  const marker = 'SYNTHETIC-DATA-MARKER';
  try {
    const old = new DatabaseSync(live);
    old.exec('CREATE TABLE sample(value TEXT); PRAGMA journal_mode=WAL;');
    old.prepare('INSERT INTO sample VALUES(?)').run(marker);
    old.close();
    assert.ok(isPlainDatabase(live));
    assert.equal(backupLegacy(live,before,key),0);
    assert.equal(isPlainDatabase(live),true);
    assert.equal((await readFile(before)).includes(Buffer.from(marker)),false);
    assert.throws(() => openDatabase(live, key), /legacy database/);
    encryptLegacy(live, key);
    assert.equal(isPlainDatabase(live), false);
    const active = openDatabase(live,key);
    try {
      assert.equal(active.prepare('SELECT value FROM sample').get().value, marker);
      assert.equal(active.pragma('user_version',{simple:true}),4);
    } finally { active.close(); }
    assert.equal((await readFile(live)).includes(Buffer.from(marker)), false);
    assert.throws(() => inspectEncrypted(live, randomBytes(32)));
    assert.equal(backupEncrypted(live,backup,key),4);
    assert.throws(() => backupEncrypted(live,backup,key), /EEXIST/);
    assert.equal(backupEncrypted(backup,restore,key),4);
    const restored = encryptedConnection(restore,key,{ readonly:true });
    try { assert.equal(restored.prepare('SELECT value FROM sample').get().value, marker); }
    finally { restored.close(); }
  } finally {
    for (const file of [live,backup,before,restore]) for (const suffix of ['','-shm','-wal','-journal']) await rm(file + suffix,{force:true});
    await rmdir(directory);
  }
});

test('production transport requires a canonical HTTPS origin and configured TLS material', async () => {
  assert.deepEqual(await transportConfiguration({}), {});
  await assert.rejects(transportConfiguration({NODE_ENV:'production'}), /requires/);
  const env = { LUNARA_ORIGIN:'http://localhost:4173', LUNARA_TLS_CERT_FILE:'missing-cert', LUNARA_TLS_KEY_FILE:'missing-key' };
  await assert.rejects(transportConfiguration(env), /HTTPS origin/);
  await assert.rejects(transportConfiguration({ ...env, LUNARA_ORIGIN:'https://localhost:4173' }), /ENOENT/);
});
