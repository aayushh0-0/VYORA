/**
 * Load project-root .env regardless of process.cwd().
 * backend/src -> ../.. is VYORA_ root.
 * Never logs secret values.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const envPath = path.join(root, '.env');

const result = dotenv.config({ path: envPath });

if (result.error && !fs.existsSync(envPath)) {
  // Fallback: cwd .env (e.g. user started from a nested folder with a local file)
  dotenv.config();
}

export const projectRoot = root;
export const envFileFound = fs.existsSync(envPath);

/** True when a non-empty GEMINI_API_KEY is present (value never returned). */
export function hasGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

// Trim common accidental whitespace/quotes around the key without logging it
if (typeof process.env.GEMINI_API_KEY === 'string') {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY.trim().replace(/^['"]|['"]$/g, '');
}
if (typeof process.env.GEMINI_MODEL === 'string') {
  process.env.GEMINI_MODEL = process.env.GEMINI_MODEL.trim().replace(/^['"]|['"]$/g, '');
}
