import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = 'scripts/qa/validate-plant-data.js';
const fixtures = path.join('tests', 'fixtures', 'validator');
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('default run (repo root) exits 0', () => {
  const result = run();
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
});

test('valid published fixture passes', () => {
  const result = run(path.join(fixtures, 'valid'));
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 1 record\(s\)\./);
  assert.doesNotMatch(result.stderr, /ERROR/);
});

test('published record with genus_only confidence fails', () => {
  const result = run(path.join(fixtures, 'invalid'));
  assert.strictEqual(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 1 record\(s\)\./);
  assert.match(result.stderr, /ERROR: .*plant-genus-only\.json:plant_invalid_genus_only_001: invalid published record/);
});

test('PLANT_DATA_ROOT env var selects the root', () => {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, PLANT_DATA_ROOT: path.join(fixtures, 'invalid') },
  });
  assert.strictEqual(result.status, 1, result.stderr || result.stdout);
});
