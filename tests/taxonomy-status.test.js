import test from 'node:test';
import assert from 'node:assert/strict';
import { TAXONOMY_STATUSES, normalizeTaxonomyStatus } from '../src/db/supabase-catalog.js';

test('accepts exactly the values allowed by the plants_taxonomy_status_check constraint', () => {
  assert.deepEqual([...TAXONOMY_STATUSES], ['manual-unverified', 'source-suggested', 'editor-confirmed', 'needs-review']);
  for (const status of TAXONOMY_STATUSES) assert.equal(normalizeTaxonomyStatus(status), status);
});

test('rejects unknown, empty and non-string statuses with a 400-mapped message', () => {
  for (const bad of ['confirmed', 'Потвърдено', '', null, 42, 'EDITOR-CONFIRMED']) {
    assert.throws(() => normalizeTaxonomyStatus(bad), /Invalid taxonomy status/);
  }
});
