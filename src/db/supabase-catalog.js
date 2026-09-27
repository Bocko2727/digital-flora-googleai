import { readWithFallback, writeWithFallback } from './supabase.js';
import { supabaseRest } from './supabase-rest.js';

// Catalog writes. Each runs on the Postgres pool when it can connect; when it
// cannot (no pool, or the connection itself failed) the same operation runs
// through the Supabase Data API, so an unusable SUPABASE_DB_URL no longer
// makes every write fail. `actor` is req.catalogActor from the auth middleware.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_MAP = { commonName: 'common_name', latinName: 'latin_name', family: 'family', photos: 'photos', confidence: 'confidence', recognition: 'recognition', habitat: 'habitat', lookalikes: 'lookalikes', benefits: 'benefits', risks: 'risks', uses: 'uses', funFact: 'fun_fact', taxonomyStatus: 'taxonomy_status' };
const INSERT_COLUMNS = ['common_name', 'latin_name', 'family', 'photos', 'confidence', 'recognition', 'habitat', 'lookalikes', 'benefits', 'risks', 'uses', 'fun_fact', 'author_email', 'taxonomy_status'];
const RETURN_ROWS = 'return=representation';

function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`); return value.trim(); }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function normalizedPhotos(value) { if (value === undefined) return []; if (!Array.isArray(value) || value.some((photo) => typeof photo !== 'string' || !photo.trim())) throw new Error('photos must be an array of non-empty strings.'); return value.map((photo) => photo.trim()); }
// Provenance of the identification (column public.plants.taxonomy_status,
// CHECK-constrained in migration 20260921151658). CLAUDE.md §4.13.
export const TAXONOMY_STATUSES = Object.freeze(['manual-unverified', 'source-suggested', 'editor-confirmed', 'needs-review']);
export function normalizeTaxonomyStatus(value) { if (!TAXONOMY_STATUSES.includes(value)) throw new Error('Invalid taxonomy status.'); return value; }
function assertUuid(id) { if (!UUID_RE.test(id)) throw new Error('Invalid plant id.'); }
function updateValue(key, value) { if (key === 'photos') return normalizedPhotos(value); if (key === 'commonName' || key === 'latinName') return requiredText(value, key); if (key === 'taxonomyStatus') return normalizeTaxonomyStatus(value); return optionalText(value); }
function updateAssignment(key, index) { return key === 'photos' ? `${FIELD_MAP[key]} = $${index}::jsonb` : `${FIELD_MAP[key]} = $${index}`; }
// pg receives jsonb as JSON text; the Data API takes the array itself.
function pgValue(column, value) { return column === 'photos' ? JSON.stringify(value) : value; }
// Data API rows; an empty body (e.g. a 204) counts as no rows instead of throwing.
function rowsOf(result) { return Array.isArray(result) ? result : []; }

export async function insertSupabasePlant(input, actor) {
    const row = {
        common_name: requiredText(input.commonName, 'commonName'),
        latin_name: requiredText(input.latinName, 'latinName'),
        family: optionalText(input.family),
        photos: normalizedPhotos(input.photos),
        confidence: optionalText(input.confidence) || 'Вероятно',
        recognition: optionalText(input.recognition),
        habitat: optionalText(input.habitat),
        lookalikes: optionalText(input.lookalikes),
        benefits: optionalText(input.benefits),
        risks: optionalText(input.risks),
        uses: optionalText(input.uses),
        fun_fact: optionalText(input.funFact),
        author_email: actor.email,
        taxonomy_status: input.taxonomyStatus === undefined ? 'manual-unverified' : normalizeTaxonomyStatus(input.taxonomyStatus),
    };
    return writeWithFallback(
        async (pool) => {
            const values = INSERT_COLUMNS.map((column) => pgValue(column, row[column]));
            const { rows } = await pool.query(`insert into public.plants (common_name, latin_name, family, photos, confidence, recognition, habitat, lookalikes, benefits, risks, uses, fun_fact, author_email, taxonomy_status) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`, values);
            return rows[0];
        },
        async () => rowsOf(await supabaseRest('plants?select=id', { method: 'POST', body: row, accessToken: actor.accessToken, prefer: RETURN_ROWS }))[0] || null,
    );
}

export async function updateSupabasePlant(id, input, actor) {
    assertUuid(id);
    const keys = Object.keys(FIELD_MAP).filter((key) => input[key] !== undefined);
    if (!keys.length) throw new Error('No supported plant fields were provided.');
    const values = keys.map((key) => updateValue(key, input[key]));
    return writeWithFallback(
        async (pool) => {
            const assignments = keys.map((key, index) => updateAssignment(key, index + 1));
            const params = keys.map((key, index) => pgValue(FIELD_MAP[key], values[index]));
            params.push(id);
            const { rows } = await pool.query(`update public.plants set ${assignments.join(', ')}, updated_at = now() where id = $${params.length} returning id`, params);
            return rows[0] || null;
        },
        async () => {
            const body = Object.fromEntries(keys.map((key, index) => [FIELD_MAP[key], values[index]]));
            body.updated_at = new Date().toISOString();
            const rows = rowsOf(await supabaseRest(`plants?id=eq.${id}&select=id`, { method: 'PATCH', body, accessToken: actor?.accessToken, prefer: RETURN_ROWS }));
            return rows[0] || null;
        },
    );
}

export async function deleteSupabasePlant(id, actor) {
    assertUuid(id);
    return writeWithFallback(
        async (pool) => {
            const { rows } = await pool.query('delete from public.plants where id = $1 returning id', [id]);
            return rows[0] || null;
        },
        async () => rowsOf(await supabaseRest(`plants?id=eq.${id}&select=id`, { method: 'DELETE', accessToken: actor?.accessToken, prefer: RETURN_ROWS }))[0] || null,
    );
}

export async function supabasePlantExists(id, actor) {
    assertUuid(id);
    return readWithFallback(
        async (pool) => {
            const { rows } = await pool.query('select 1 from public.plants where id = $1 limit 1', [id]);
            return rows.length > 0;
        },
        async () => rowsOf(await supabaseRest(`plants?id=eq.${id}&select=id&limit=1`, { accessToken: actor?.accessToken })).length > 0,
    );
}

// The Data API has no atomic "append to jsonb array", so it does a
// compare-and-set on updated_at: when a concurrent write changed the row
// between the read and the update, the update matches no row and the loop
// reads the row again.
const PHOTO_APPEND_ATTEMPTS = 3;

async function appendPhotoViaDataApi(id, photo, accessToken) {
    for (let attempt = 0; attempt < PHOTO_APPEND_ATTEMPTS; attempt += 1) {
        const [current] = rowsOf(await supabaseRest(`plants?id=eq.${id}&select=photos,updated_at&limit=1`, { accessToken }));
        if (!current) return null;
        const existing = Array.isArray(current.photos) ? current.photos : [];
        const photos = existing.filter((entry) => entry !== 'placeholder.jpg').concat(photo);
        const [updated] = rowsOf(await supabaseRest(`plants?id=eq.${id}&updated_at=eq.${encodeURIComponent(current.updated_at)}&select=id,photos`, { method: 'PATCH', body: { photos, updated_at: new Date().toISOString() }, accessToken, prefer: RETURN_ROWS }));
        if (updated) return updated;
    }
    throw new Error('The plant kept changing while its photo list was being updated.');
}

// Appends one photo URL atomically in SQL (no read-modify-write), so two
// concurrent uploads to the same plant cannot overwrite each other. A legacy
// 'placeholder.jpg' entry is dropped, as the previous JS-side merge did.
export async function appendSupabasePlantPhoto(id, photoUrl, actor) {
    assertUuid(id);
    const [photo] = normalizedPhotos([photoUrl]);
    return writeWithFallback(
        async (pool) => {
            const { rows } = await pool.query(`update public.plants set photos = coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(photos, '[]'::jsonb)) as e where e <> '"placeholder.jpg"'::jsonb), '[]'::jsonb) || $1::jsonb, updated_at = now() where id = $2 returning id, photos`, [JSON.stringify([photo]), id]);
            return rows[0] || null;
        },
        () => appendPhotoViaDataApi(id, photo, actor?.accessToken),
    );
}
