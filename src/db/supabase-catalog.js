import supabasePool from './supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_MAP = { commonName: 'common_name', latinName: 'latin_name', family: 'family', photos: 'photos', confidence: 'confidence', recognition: 'recognition', habitat: 'habitat', lookalikes: 'lookalikes', benefits: 'benefits', risks: 'risks', uses: 'uses', funFact: 'fun_fact' };

function pool() { if (!supabasePool) throw new Error('Supabase database connection is unavailable.'); return supabasePool; }
function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`); return value.trim(); }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function normalizedPhotos(value) { if (value === undefined) return []; if (!Array.isArray(value) || value.some((photo) => typeof photo !== 'string' || !photo.trim())) throw new Error('photos must be an array of non-empty strings.'); return value.map((photo) => photo.trim()); }
function assertUuid(id) { if (!UUID_RE.test(id)) throw new Error('Invalid plant id.'); }
function updateValue(key, value) { if (key === 'photos') return JSON.stringify(normalizedPhotos(value)); if (key === 'commonName' || key === 'latinName') return requiredText(value, key); return optionalText(value); }
function updateAssignment(key, index) { return key === 'photos' ? `${FIELD_MAP[key]} = $${index}::jsonb` : `${FIELD_MAP[key]} = $${index}`; }

export async function insertSupabasePlant(input, actor) {
    const values = [requiredText(input.commonName, 'commonName'), requiredText(input.latinName, 'latinName'), optionalText(input.family), JSON.stringify(normalizedPhotos(input.photos)), optionalText(input.confidence) || 'Вероятно', optionalText(input.recognition), optionalText(input.habitat), optionalText(input.lookalikes), optionalText(input.benefits), optionalText(input.risks), optionalText(input.uses), optionalText(input.funFact), actor.email];
    const { rows } = await pool().query(`insert into public.plants (common_name, latin_name, family, photos, confidence, recognition, habitat, lookalikes, benefits, risks, uses, fun_fact, author_email) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`, values);
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