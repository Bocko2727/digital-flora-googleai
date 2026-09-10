#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'images']);
const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{20,}/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
];
let findings = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|ts|json|ya?ml|md|html|txt)$/i.test(entry.name) && entry.name !== '.env.example') scan(file);
  }
}

function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      console.error(`ERROR: possible ${name} in ${file}`);
      findings += 1;
    }
  }
}

walk(process.cwd());
console.log(`Secret scan completed with ${findings} finding(s).`);
process.exitCode = findings ? 1 : 0;
