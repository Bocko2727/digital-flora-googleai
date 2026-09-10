import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/qa/validate-plant-data.js'],{encoding:'utf8'});
assert.strictEqual(result.status,0,result.stderr||result.stdout);
