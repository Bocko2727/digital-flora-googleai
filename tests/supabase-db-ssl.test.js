import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSslConfig } from '../src/db/supabase.js';

test('falls back to relaxed verification when no CA cert is configured', () => {
    assert.deepEqual(resolveSslConfig(undefined), { rejectUnauthorized: false });
    assert.deepEqual(resolveSslConfig(''), { rejectUnauthorized: false });
});

test('uses verify-full once a CA cert is configured', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
    assert.deepEqual(resolveSslConfig(pem), { ca: pem, rejectUnauthorized: true });
});

test('normalizes a CA cert whose newlines were collapsed into literal \\n escapes', () => {
    const collapsed = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';
    const expected = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
    const result = resolveSslConfig(collapsed);
    assert.equal(result.ca, expected);
    assert.equal(result.rejectUnauthorized, true);
});
