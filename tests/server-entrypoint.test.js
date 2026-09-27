import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
// Keeps this process away from any real Supabase project: without these
// settings the server uses only the local archive.
import './support/isolated-supabase-env.js';

delete process.env.VERCEL;

const { default: app } = await import('../server.js');

function listeningServers() {
  return process._getActiveHandles().filter((handle) => handle instanceof net.Server).length;
}

test('server.js default-exports the Express app for the Vercel runtime', () => {
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});

test('importing server.js does not open a port (Vercel serves the export)', () => {
  assert.equal(listeningServers(), 0);
});

test('the exported app serves requests when mounted by a host', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// The 2026-09-26 production outage: the Vercel project skipped the install
// step, so the function bundle had no node_modules ("Cannot find package
// 'express'"). vercel.json pins the install command in the repository.
test('vercel.json installs dependencies from the lockfile', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.buildCommand, 'npm run build');
});
