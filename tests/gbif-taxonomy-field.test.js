import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGbifTaxonomy } from '../src/db/supabase-catalog.js';

test('accepts null (clearing any previous GBIF suggestion)', () => {
  assert.equal(normalizeGbifTaxonomy(null), null);
});

test('keeps only the documented keys from a GBIF suggestion payload', () => {
  const input = {
    key: 123, scientificName: 'Ajuga reptans L.', canonicalName: 'Ajuga reptans',
    rank: 'SPECIES', status: 'ACCEPTED', family: 'Lamiaceae', kingdom: 'Plantae',
    fetchedAt: '2026-09-26T00:00:00.000Z',
    unexpectedField: 'should be dropped',
  };
  const result = normalizeGbifTaxonomy(input);
  assert.deepEqual(result, {
    key: 123, scientificName: 'Ajuga reptans L.', canonicalName: 'Ajuga reptans',
    rank: 'SPECIES', status: 'ACCEPTED', family: 'Lamiaceae', kingdom: 'Plantae',
    fetchedAt: '2026-09-26T00:00:00.000Z',
  });
});

test('rejects an array and other non-plain-object payloads', () => {
  for (const bad of [[], 'Ajuga reptans', 42, true]) {
    assert.throws(() => normalizeGbifTaxonomy(bad), /Invalid gbif taxonomy payload/);
  }
});

test('rejects a payload larger than the stored-size cap', () => {
  const oversized = { scientificName: 'x'.repeat(5000) };
  assert.throws(() => normalizeGbifTaxonomy(oversized), /too large/);
});
