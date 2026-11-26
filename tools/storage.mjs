import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupEncrypted, backupLegacy, encryptLegacy, inspectEncrypted, isPlainDatabase, loadDatabaseKey } from '../backend/storage.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const live = resolve(process.env.LUNARA_DB ?? resolve(root, 'data/lunara.sqlite'));
const [command, ...args] = process.argv.slice(2);
if (!['migrate','backup','backup-legacy','verify','restore-copy'].includes(command) || !args.length) {
  throw new Error('Use migrate <file> [file...], backup <new-copy>, backup-legacy <new-copy>, verify <file>, or restore-copy <backup> <new-copy>.');
}
const key = loadDatabaseKey(live, { allowLegacy:command === 'migrate' || command === 'backup-legacy' });

if (command === 'migrate') {
  for (const argument of args) {
    const file = resolve(argument);
    if (!existsSync(file)) throw new Error('Migration requires an existing database.');
    const state = isPlainDatabase(file) ? 'converted' : 'already encrypted';
    const version = encryptLegacy(file, key);
    console.log(`Storage ${state}; integrity verified; schema ${version}.`);
  }
} else if (command === 'backup' || command === 'backup-legacy' || command === 'restore-copy') {
  if (args.length !== (command === 'restore-copy' ? 2 : 1)) throw new Error('Provide the exact source and new destination.');
  const source = command === 'restore-copy' ? resolve(args[0]) : live;
  const destination = resolve(args.at(-1));
  mkdirSync(dirname(destination), { recursive:true, mode:0o700 });
  const version = (command === 'backup-legacy' ? backupLegacy : backupEncrypted)(source, destination, key);
  console.log(`Encrypted copy integrity verified; schema ${version}.`);
} else {
  const version = inspectEncrypted(resolve(args[0]), key);
  console.log(`Encrypted database integrity verified; schema ${version}.`);
}
