import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// U+FFFD (the Unicode replacement character) in source means a tool split a
// multi-byte UTF-8 character and the Bulgarian text is now broken for users.
// Commit 68a3bc9 shipped three of these (the Save button's "З" became two
// replacement characters), which only the e2e suite noticed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_FILE = /\.(?:m?js|html|css|json|md|sql|ya?ml|svg|txt)$/i;
const SKIP = /(^|\/)(node_modules|vendor)\//;
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

function trackedTextFiles() {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    // Not a git checkout: check the first-party source directly.
    files = ['server.js', 'app.js', 'index.html', 'sw.js', 'theme-init.js'];
  }
  return files.filter((file) => TEXT_FILE.test(file) && !SKIP.test(file) && fs.existsSync(path.join(root, file)));
}

test('tracked text files contain no U+FFFD replacement characters', () => {
  const files = trackedTextFiles();
  assert.ok(files.includes('app.js') && files.includes('server.js'), 'expected to scan app.js and server.js');
  const broken = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (line.includes(REPLACEMENT_CHARACTER)) broken.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(broken, [], `broken UTF-8 text at: ${broken.join(', ')}`);
});
