const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, [path.join('scripts', 'qa', 'validate-plant-data.js')], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr || result.stdout);
