import assert from 'node:assert/strict';
import test from 'node:test';
import { searchGbifTaxa, _clearGbifCacheForTests, GbifRateLimitedError } from '../src/integrations/gbif.js';

function jsonResponse(body, { status = 200, retryAfter } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
        json: async () => body,
    };
}

test('returns an empty array without calling fetch for a too-short query', async () => {
    _clearGbifCacheForTests();
    let called = false;
    const fetchStub = async () => { called = true; return jsonResponse([]); };
    const result = await searchGbifTaxa('a', fetchStub);
    assert.deepEqual(result, []);
    assert.equal(called, false);
});

test('maps a GBIF suggest response onto the documented candidate shape', async () => {
    _clearGbifCacheForTests();
    const fetchStub = async () => jsonResponse([
        { key: 123, scientificName: 'Ajuga reptans L.', canonicalName: 'Ajuga reptans', rank: 'SPECIES', status: 'ACCEPTED', kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Magnoliopsida', order: 'Lamiales', family: 'Lamiaceae', genus: 'Ajuga' },
    ]);
    const result = await searchGbifTaxa('Ajuga reptans', fetchStub);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
        taxonKey: 123,
        scientificName: 'Ajuga reptans L.',
        canonicalName: 'Ajuga reptans',
        rank: 'SPECIES',
        status: 'ACCEPTED',
        kingdom: 'Plantae',
        phylum: 'Tracheophyta',
        class: 'Magnoliopsida',
        order: 'Lamiales',
        family: 'Lamiaceae',
        genus: 'Ajuga',
    });
});

test('caches a successful response and does not re-fetch for the same normalized query', async () => {
    _clearGbifCacheForTests();
    let callCount = 0;
    const fetchStub = async () => { callCount++; return jsonResponse([{ key: 1, scientificName: 'Bellis perennis' }]); };
    await searchGbifTaxa('  Bellis   perennis  ', fetchStub);
    await searchGbifTaxa('bellis perennis', fetchStub);
    assert.equal(callCount, 1);
});

test('throws GbifRateLimitedError with a retry-after value on HTTP 429', async () => {
    _clearGbifCacheForTests();
    const fetchStub = async () => jsonResponse(null, { status: 429, retryAfter: '12' });
    await assert.rejects(
        () => searchGbifTaxa('rate limited query', fetchStub),
        (error) => error instanceof GbifRateLimitedError && error.retryAfterSeconds === 12,
    );
});

test('does not cache a rate-limited or failed response', async () => {
    _clearGbifCacheForTests();
    let callCount = 0;
    const fetchStub = async () => { callCount++; return jsonResponse(null, { status: 429 }); };
    await assert.rejects(() => searchGbifTaxa('flaky query', fetchStub));
    await assert.rejects(() => searchGbifTaxa('flaky query', fetchStub));
    assert.equal(callCount, 2);
});

test('caches an empty result set with its own (shorter) negative-cache entry', async () => {
    _clearGbifCacheForTests();
    let callCount = 0;
    const fetchStub = async () => { callCount++; return jsonResponse([]); };
    await searchGbifTaxa('nonexistent taxon name', fetchStub);
    await searchGbifTaxa('nonexistent taxon name', fetchStub);
    assert.equal(callCount, 1);
});
