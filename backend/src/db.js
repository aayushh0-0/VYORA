/**
 * VYORA SQLite runtime — uses Node.js built-in `node:sqlite` (DatabaseSync).
 * No native compile step, no Visual Studio build tools, works on Node 22.5+ / 24.
 * API surface matches the previous better-sqlite3 usage in this codebase:
 *   db.prepare().run/get/all, db.exec, seed inserts.
 */
import './loadEnv.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(root, process.env.DATABASE_PATH)
  : path.join(root, 'database/vyora.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

// node:sqlite has no .pragma() helper — set via SQL
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
db.exec(schema);

const seed = db.prepare(
  'INSERT OR IGNORE INTO trainers (id,name,specialty,bio,price,verified,active) VALUES (?,?,?,?,?,?,?)'
);
[
  ['trainer-strength-1', 'Coach Arjun', 'Strength & muscle gain', 'Progressive strength training and beginner-friendly coaching.', 799, 1, 1],
  ['trainer-wellness-1', 'Coach Riya', 'General fitness & mobility', 'Sustainable routines, mobility and habit coaching.', 699, 1, 1],
  ['trainer-endurance-1', 'Coach Dev', 'Running & endurance', 'Build endurance with gradual, recovery-aware plans.', 899, 1, 1]
].forEach((x) => seed.run(...x));

export function isoNow() {
  return new Date().toISOString();
}
export function makeId() {
  return crypto.randomUUID();
}
