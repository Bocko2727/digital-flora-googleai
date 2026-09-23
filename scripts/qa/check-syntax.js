#!/usr/bin/env node
// Dependency-free syntax check: runs `node --check` on every tracked .js file
// at the repo root (server.js, app.js, sw.js, theme-init.js,
// playwright.config.js) and in src/, scripts/ and tests/. Exits 1 and lists failures.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = ['server.js', 'app.js', 'sw.js', 'theme-init.js', 'playwright.config.js', 'src', 'scripts', 'tests'];
const skip = /(^|\/)(node_modules|vendor)\//;

function walk(p) {
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap(e =>
    e.name === 'node_modules' || e.name === 'vendor' ? [] : walk(path.join(p, e.name)));
}

let files;
try {
  files = execFileSync('git', ['ls-files', '-z', '--', ...targets], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
} catch {
  // Not a git checkout: fall back to a directory walk.
  files = targets.flatMap(t => walk(path.join(root, t)))
    .map(f => path.relative(root, f).split(path.sep).join('/'));
}
files = files.filter(f => f.endsWith('.js') && !skip.test(f) && fs.existsSync(path.join(root, f))).sort();

const failures = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) failures.push({ f, out: (r.stderr || r.stdout || '').trim() });
}
for (const { f, out } of failures) console.error(`SYNTAX ERROR: ${f}\n${out}\n`);
console.log(`Syntax-checked ${files.length} file(s), ${failures.length} failure(s).`);
if (!files.length) {
  console.error('ERROR: no .js files found to check.');
  process.exitCode = 1;
} else {
  process.exitCode = failures.length ? 1 : 0;
}
