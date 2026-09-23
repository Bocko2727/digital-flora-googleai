import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evaluate } from '../.claude/hooks/guard-bash.js';

const onBranch = (name) => () => name;

test('blocks reading or printing .env files', () => {
  for (const command of ['cat .env', 'less ./.env.local', 'grep KEY .env.production', 'source .env && node x.js', 'node --env-file=.env server.js', 'head -1 config/.env']) {
    assert.ok(evaluate(command), command);
  }
});

test('allows .env.example and unrelated env usage', () => {
  for (const command of ['cat .env.example', 'node -e "console.log(process.env.PORT)"', 'env FOO=1 node server.js', 'set -e', 'ls .envrc']) {
    assert.equal(evaluate(command), null, command);
  }
});

test('blocks key/credential files and full environment dumps', () => {
  for (const command of ['cat server.pem', 'cat ~/.ssh/id_rsa', 'cat gcp-service-account.json', 'cat ~/.claude/.credentials.json', 'printenv', 'env', 'env | sort', 'export -p']) {
    assert.ok(evaluate(command), command);
  }
});

test('blocks force-push, deletion and pushes to main', () => {
  for (const command of [
    'git push --force origin feature',
    'git push -f origin feature',
    'git push origin +feature',
    'git push --force-with-lease',
    'git push origin --delete old-branch',
    'git push origin :old-branch',
    'git push origin main',
    'git push origin HEAD:main',
    'git -C . push origin refs/heads/main',
    'npm test && git push origin main'
  ]) {
    assert.ok(evaluate(command, onBranch('feature')), command);
  }
});

test('bare push is blocked only when main is checked out', () => {
  assert.ok(evaluate('git push', onBranch('main')));
  assert.ok(evaluate('git push -u origin', onBranch('main')));
  assert.equal(evaluate('git push', onBranch('chore/x')), null);
});

test('allows normal feature-branch pushes and other git commands', () => {
  for (const command of ['git push -u origin chore/claude-code-environment', 'git push origin refactor/catalog-foundation', 'git status --short', 'git log --oneline -8', 'git diff main...HEAD']) {
    assert.equal(evaluate(command, onBranch('main')), null, command);
  }
});

test('hook entry point exits 2 with a reason on stdin payloads it blocks', () => {
  const hook = new URL('../.claude/hooks/guard-bash.js', import.meta.url);
  const blocked = spawnSync(process.execPath, [hook.pathname], { input: JSON.stringify({ tool_input: { command: 'cat .env' } }), encoding: 'utf8' });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /\.env/);
  const allowed = spawnSync(process.execPath, [hook.pathname], { input: JSON.stringify({ tool_input: { command: 'npm test' } }), encoding: 'utf8' });
  assert.equal(allowed.status, 0);
  const garbage = spawnSync(process.execPath, [hook.pathname], { input: 'not json', encoding: 'utf8' });
  assert.equal(garbage.status, 0);
});
