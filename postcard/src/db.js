import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Append-only: each entry runs once, tracked via PRAGMA user_version.
const MIGRATIONS = [
  `
  CREATE TABLE postcards (
    id              TEXT PRIMARY KEY,
    parent_id       TEXT REFERENCES postcards(id),
    sender_name     TEXT NOT NULL,
    recipient_name  TEXT NOT NULL,
    message         TEXT NOT NULL,
    theme           TEXT NOT NULL,
    unlock_at       INTEGER,
    created_at      INTEGER NOT NULL,
    opened_at       INTEGER,
    sender_key_hash TEXT NOT NULL
  );
  CREATE INDEX postcards_parent_id ON postcards(parent_id);
  `,
];

export function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}
