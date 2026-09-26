import supabasePool from './supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_MAP = { commonName: 'common_name', latinName: 'latin_name', family: 'family', photos: 'photos', confidence: 'confidence', recognition: 'recognition', habitat: 'habitat', lookalikes: 'lookalikes', benefits: 'benefits', risks: 'risks', uses: 'uses', funFact: 'fun_fact', taxonomyStatus: 'taxonomy_status' };

function pool() { if (!supabasePool) throw new Error('Supabase database connection is unavailable.'); return supabasePool; }
function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`); return value.trim(); }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function normalizedPhotos(value) { if (value === undefined) return []; if (!Array.isArray(value) || value.some((photo) => typeof photo !== 'string' || !photo.trim())) throw new Error('photos must be an array of non-empty strings.'); return value.map((photo) => photo.trim()); }
// Provenance of the identification (column public.plants.taxonomy_status,
// CHECK-constrained in migration 20260921151658). CLAUDE.md §4.13.
export const TAXONOMY_STATUSES = Object.freeze(['manual-unverified', 'source-suggested', 'editor-confirmed', 'needs-review']);
export function normalizeTaxonomyStatus(value) { if (!TAXONOMY_STATUSES.includes(value)) throw new Error('Invalid taxonomy status.'); return value; }
function assertUuid(id) { if (!UUID_RE.test(id)) throw new Error('Invalid plant id.'); }
function updateValue(key, value) { if (key === 'photos') return JSON.stringify(normalizedPhotos(value)); if (key === 'commonName' || key === 'latinName') return requiredText(value, key); if (key === 'taxonomyStatus') return normalizeTaxonomyStatus(value); return optionalText(value); }
function updateAssignment(key, index) { return key === 'photos' ? `${FIELD_MAP[key]} = $${index}::jsonb` : `${FIELD_MAP[key]} = $${index}`; }

export async function insertSupabasePlant(input, actor) {
    const values = [requiredText(input.commonName, 'commonName'), requiredText(input.latinName, 'latinName'), optionalText(input.family), JSON.stringify(normalizedPhotos(input.photos)), optionalText(input.confidence) || 'Вероятно', optionalText(input.recognition), optionalText(input.habitat), optionalText(input.lookalikes), optionalText(input.benefits), optionalText(input.risks), optionalText(input.uses), optionalText(input.funFact), actor.email, input.taxonomyStatus === undefined ? 'manual-unverified' : normalizeTaxonomyStatus(input.taxonomyStatus)];
    const { rows } = await pool().query(`insert into public.plants (common_name, latin_name, family, photos, confidence, recognition, habitat, lookalikes, benefits, risks, uses, fun_fact, author_email, taxonomy_status) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`, values);
    return rows[0];
}

export async function updateSupabasePlant(id, input) {
    assertUuid(id);
    const keys = Object.keys(FIELD_MAP).filter((key) => input[key] !== undefined);
    if (!keys.length) throw new Error('No supported plant fields were provided.');
    const values = keys.map((key) => updateValue(key, input[key]));
    const assignments = keys.map((key, index) => updateAssignment(key, index + 1));
    values.push(id);
    const { rows } = await pool().query(`update public.plants set ${assignments.join(', ')}, updated_at = now() where id = $${values.length} returning id`, values);
    return rows[0] || null;
}

export async function deleteSupabasePlant(id) {
    assertUuid(id);
    const { rows } = await pool().query('delete from public.plants where id = $1 returning id', [id]);
    return rows[0] || null;
}
export async function supabasePlantExists(id) {
    assertUuid(id);
    const { rows } = await pool().query('select 1 from public.plants where id = $1 limit 1', [id]);
    return rows.length > 0;
}

// Appends one photo URL atomically in SQL (no read-modify-write), so two
// concurrent uploads to the same plant cannot overwrite each other. A legacy
// 'placeholder.jpg' entry is dropped, as the previous JS-side merge did.
export async function appendSupabasePlantPhoto(id, photoUrl) {
    assertUuid(id);
    const photo = JSON.stringify(normalizedPhotos([photoUrl]));
    const { rows } = await pool().query(`update public.plants set photos = coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(photos, '[]'::jsonb)) as e where e <> '"placeholder.jpg"'::jsonb), '[]'::jsonb) || $1::jsonb, updated_at = now() where id = $2 returning id, photos`, [photo, id]);
    return rows[0] || null;
}
