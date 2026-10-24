/**
 * VYORA local development launcher
 * Starts Express (API + optional static) and Vite (frontend HMR) together.
 * Ctrl+C stops both. No native build tools required.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const children = [];

function start(name, args) {
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    shell: isWin,
    env: process.env
  });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    try {
      if (!c.killed) c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  // Windows sometimes needs a harder stop
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('VYORA dev');
console.log('  Backend:  http://localhost:3000  (API)');
console.log('  Frontend: http://localhost:5173  (open this in the browser)');
console.log('  Ctrl+C stops both processes.\n');

start('backend', ['run', 'dev:backend']);
start('frontend', ['run', 'dev:frontend']);
