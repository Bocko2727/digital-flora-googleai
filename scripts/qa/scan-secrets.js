#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'images']);
const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{20,}/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['generic secret assignment', /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'](?!\$\{)[^"'\s]{12,}["']/gi]
];
let findings = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|ts|json|ya?ml|md|html|txt)$/i.test(entry.name) && entry.name !== '.env.example') scan(full);
  }
}
function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) { console.error(`ERROR: possible ${name} in ${path.relative(root, file)}`); findings += 1; }
  }
}
walk(root);
console.log(`Secret scan completed with ${findings} finding(s).`);
process.exitCode = findings ? 1 : 0;
