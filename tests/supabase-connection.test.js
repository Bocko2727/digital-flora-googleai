import test from 'node:test';
import assert from 'node:assert/strict';

// No pool in this process: only the pure helpers of src/db/supabase.js are tested.
delete process.env.SUPABASE_DB_URL;
const { directHostWarning, isConnectionError, withoutTlsParams } = await import('../src/db/supabase.js');

function errorWith(fields) {
  return Object.assign(new Error(fields.message || 'failure'), fields);
}

test('connect-phase failures are classified as connection errors', () => {
  // The two production failures seen on Vercel on 2026-09-25/26.
  assert.equal(isConnectionError(errorWith({ code: 'ENOTFOUND', syscall: 'getaddrinfo', message: 'getaddrinfo ENOTFOUND db.sxuxtsbyqjaodyuqebux.supabase.co' })), true);
  assert.equal(isConnectionError(errorWith({ code: '28P01', message: 'password authentication failed for user "postgres"' })), true);
  assert.equal(isConnectionError(errorWith({ code: 'ECONNREFUSED', syscall: 'connect' })), true);
  assert.equal(isConnectionError(errorWith({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })), true);
  assert.equal(isConnectionError(errorWith({ message: 'Connection terminated due to connection timeout' })), true);
  assert.equal(isConnectionError(errorWith({ message: 'timeout exceeded when trying to connect' })), true);
  assert.equal(isConnectionError(errorWith({ code: 'XX000', message: 'Tenant or user not found' })), true);
  const dualStack = new AggregateError([
    errorWith({ code: 'ENETUNREACH', syscall: 'connect' }),
    errorWith({ code: 'ETIMEDOUT', syscall: 'connect' }),
  ], 'connect failed');
  assert.equal(isConnectionError(dualStack), true);
});

test('failures after a statement may have been sent are not connection errors', () => {
  assert.equal(isConnectionError(errorWith({ code: '23514', message: 'new row violates check constraint' })), false);
  assert.equal(isConnectionError(errorWith({ code: '42501', message: 'permission denied for table plants' })), false);
  // The same network code on an open socket (read/write) is not pre-connect.
  assert.equal(isConnectionError(errorWith({ code: 'ETIMEDOUT', syscall: 'read' })), false);
  assert.equal(isConnectionError(errorWith({ code: 'ECONNRESET', syscall: 'read' })), false);
  assert.equal(isConnectionError(errorWith({ message: 'Connection terminated unexpectedly' })), false);
  assert.equal(isConnectionError(null), false);
  assert.equal(isConnectionError(new AggregateError([], 'empty')), false);
});

test('withoutTlsParams drops TLS parameters so the ssl option decides TLS', () => {
  const integrationUrl = 'postgres://postgres.ref:p%40ss@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x';
  const cleaned = new URL(withoutTlsParams(integrationUrl));
  assert.equal(cleaned.searchParams.has('sslmode'), false);
  assert.equal(cleaned.searchParams.get('supa'), 'base-pooler.x');
  assert.equal(cleaned.password, 'p%40ss');
  assert.equal(cleaned.host, 'aws-0-eu-central-1.pooler.supabase.com:6543');
  assert.equal(
    withoutTlsParams('postgres://u:p@h:6543/postgres?sslmode=verify-full&sslrootcert=/tmp/ca.pem&uselibpqcompat=true'),
    'postgres://u:p@h:6543/postgres',
  );
});

test('pg applies the configured ssl option once sslmode is dropped', async () => {
  const { default: pg } = await import('pg');
  const integrationUrl = 'postgres://postgres.ref:placeholder@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require';
  const verifyWithCa = { ca: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----', rejectUnauthorized: true };
  // Without the fix pg replaces the option with {} (verify-full, system CAs).
  const client = new pg.Client({ connectionString: withoutTlsParams(integrationUrl), ssl: verifyWithCa });
  assert.deepEqual(client.connectionParameters.ssl, verifyWithCa);
  assert.equal(client.connectionParameters.port, 6543);
});

test('withoutTlsParams leaves other connection strings untouched', () => {
  const plain = 'postgresql://postgres.ref:placeholder@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
  assert.equal(withoutTlsParams(plain), plain);
  assert.equal(withoutTlsParams('not a url'), 'not a url');
});

test('on Vercel, a direct db.<ref>.supabase.co URL gets an actionable warning', () => {
  const direct = 'postgresql://postgres:placeholder@db.sxuxtsbyqjaodyuqebux.supabase.co:5432/postgres';
  const warning = directHostWarning(direct, true);
  assert.match(warning, /db\.sxuxtsbyqjaodyuqebux\.supabase\.co/);
  assert.match(warning, /pooler\.supabase\.com:6543/);
  assert.equal(warning.includes('placeholder'), false, 'never echo the password');
  assert.equal(directHostWarning(direct, false), null, 'local and CI runs can use the direct host');
  assert.equal(directHostWarning('postgres://postgres.ref:placeholder@aws-0-eu-central-1.pooler.supabase.com:6543/postgres', true), null);
  assert.equal(directHostWarning('not a url', true), null);
});
