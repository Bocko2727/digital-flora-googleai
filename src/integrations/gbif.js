// Server-only GBIF Backbone Taxonomy lookup for the add/edit autocomplete
// (Phase 2.1). Read-only: this module never writes to Supabase — saving a
// confirmed candidate onto a plant record is a separate, explicit step in
// the editor UI (not implemented yet; depends on the taxonomy_status/
// gbif_taxonomy columns proposed in docs/migrations/, not yet applied).
//
// GBIF's species/suggest endpoint needs no API key and is meant for
// autocomplete, but GBIF documents that fast/frequent search traffic can be
// rate-limited (HTTP 429), so results are cached in-memory here to avoid
// re-querying for the same input while a user is typing/retrying.

const GBIF_SUGGEST_URL = 'https://api.gbif.org/v1/species/suggest';
const MAX_CANDIDATES = 8;
const POSITIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h: taxonomy rarely changes mid-session.
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10m: short, in case GBIF indexing catches up.

const cache = new Map();

export class GbifRateLimitedError extends Error {
    constructor(retryAfterSeconds) {
        super('GBIF rate-limited this request.');
        this.name = 'GbifRateLimitedError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

function normalizeQuery(query) {
    if (typeof query !== 'string') return '';
    return query.trim().replace(/\s+/g, ' ');
}

function cacheKey(normalizedQuery) {
    return normalizedQuery.toLowerCase();
}

function readCache(key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return undefined;
    }
    return entry.data;
}

function writeCache(key, data, ttlMs) {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function parseRetryAfterSeconds(response) {
    const header = response.headers.get('retry-after');
    const parsed = Number(header);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function mapSuggestion(raw) {
    return {
        taxonKey: raw.key,
        scientificName: raw.scientificName || null,
        canonicalName: raw.canonicalName || null,
        rank: raw.rank || null,
        status: raw.status || raw.taxonomicStatus || null,
        kingdom: raw.kingdom || null,
        phylum: raw.phylum || null,
        class: raw.class || null,
        order: raw.order || null,
        family: raw.family || null,
        genus: raw.genus || null,
    };
}

// Exported for tests only; not part of the public search API.
export function _normalizeQueryForTests(query) {
    return normalizeQuery(query);
}

export function _clearGbifCacheForTests() {
    cache.clear();
}

export async function searchGbifTaxa(query, fetchImpl = fetch) {
    const normalized = normalizeQuery(query);
    if (normalized.length < 2) return [];

    const key = cacheKey(normalized);
    const cached = readCache(key);
    if (cached !== undefined) return cached;

    const url = `${GBIF_SUGGEST_URL}?q=${encodeURIComponent(normalized)}&limit=${MAX_CANDIDATES}`;
    const response = await fetchImpl(url);

    if (response.status === 429) {
        throw new GbifRateLimitedError(parseRetryAfterSeconds(response));
    }
    if (!response.ok) {
        throw new Error(`GBIF suggest request failed with status ${response.status}.`);
    }

    const raw = await response.json();
    const candidates = Array.isArray(raw) ? raw.slice(0, MAX_CANDIDATES).map(mapSuggestion) : [];

    writeCache(key, candidates, candidates.length ? POSITIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS);
    return candidates;
}
