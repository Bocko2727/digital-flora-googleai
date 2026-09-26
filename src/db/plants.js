import supabasePool from './supabase.js';

// ---------------------------------------------------------------------------
// Supabase Postgres read path: the catalog source of truth for
// GET /api/plants. Writes live in supabase-catalog.js.
// ---------------------------------------------------------------------------

// public.plants.confidence holds three historical formats:
//   - text labels from the bulk botanical-archive import: 'high'|'medium'|'low'
//     (that archive is itself AI-generated, see data/review-results.json)
//   - numeric AI confidence scores (as text) from individual uploads: '0.0'..'1.0'
//   - display labels ('Вероятно (AI 92%)', 'Потвърдено', ...) written back by
//     the upload/editor UI.
// All map to the display strings the frontend expects. Mapping is
// idempotent: an already-mapped label round-trips unchanged, so re-saving a
// record in the editor no longer rewrites its confidence/provenance.
// AI-derived values are never labelled 'Потвърдено' (CLAUDE.md §4.13): only
// an editor can confirm a record, by setting a plain 'Потвърдено' label.
const DISPLAY_LABEL_RE = /^(Потвърдено|Вероятно|Неопределимо)/;
const AI_CONFIRMED_LABEL_RE = /^Потвърдено(?=\s*\((AI\b|Ботанически архив))/;

function isNumericConfidenceString(value) {
  return /^[01](\.\d+)?$/.test(value);
}

function formatNumericConfidence(value) {
  const asNumber = Number(value);
  const pct = Math.round(asNumber * 100) + '%';
  if (asNumber >= 0.4) return `Вероятно (AI ${pct})`;
  return `Неопределимо (AI ${pct})`;
}

function formatArchiveConfidence(value) {
  if (value === 'high') return 'Вероятно (Ботанически архив, AI висока увереност)';
  if (value === 'low') return 'Неопределимо (Ботанически архив, AI)';
  if (value === 'medium') return 'Вероятно (Ботанически архив, AI)';
  return 'Вероятно';
}

// fallow-ignore-next-line complexity
export function mapSupabaseConfidence(raw) {
  const value = raw == null ? '' : String(raw).trim();
  if (isNumericConfidenceString(value)) return formatNumericConfidence(value);
  if (AI_CONFIRMED_LABEL_RE.test(value)) return value.replace(/^Потвърдено/, 'Вероятно');
  if (DISPLAY_LABEL_RE.test(value)) return value;
  return formatArchiveConfidence(value);
}

// Optional text columns are returned as-is ('' when NULL). Display
// fallbacks ('Няма данни', ...) are applied only at render time in the UI,
// so the editor never writes placeholder text back as real botanical data.
function textOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

const PLANT_COLUMNS = [
  'id', 'common_name', 'latin_name', 'family', 'photos', 'confidence', 'recognition',
  'habitat', 'lookalikes', 'benefits', 'risks', 'uses', 'fun_fact', 'author_email',
  'taxonomy_status', 'created_at',
];

function mapPlantRow(r) {
  return {
    id: r.id,
    commonName: r.common_name || 'Неопределено растение',
    latinName: r.latin_name || 'Неопределен таксон',
    family: textOrEmpty(r.family),
    photos: Array.isArray(r.photos) && r.photos.length > 0 ? r.photos : ['placeholder.jpg'],
    confidence: mapSupabaseConfidence(r.confidence),
    recognition: textOrEmpty(r.recognition),
    habitat: textOrEmpty(r.habitat),
    lookalikes: textOrEmpty(r.lookalikes),
    benefits: textOrEmpty(r.benefits),
    risks: textOrEmpty(r.risks),
    uses: textOrEmpty(r.uses),
    funFact: textOrEmpty(r.fun_fact),
    authorEmail: r.author_email || '',
    taxonomyStatus: r.taxonomy_status || 'manual-unverified',
    createdAt: r.created_at,
  };
}

async function getPlantsViaPostgres() {
  if (!supabasePool) {
    return null;
  }
  try {
    const { rows } = await supabasePool.query(
      `SELECT ${PLANT_COLUMNS.join(', ')}
       FROM public.plants
       ORDER BY created_at DESC`
    );
    return rows.map(mapPlantRow);
  } catch (error) {
    console.error('Supabase getPlants failed:', error.message);
    return null;
  }
}

// Read-only fallback through the Supabase Data API (PostgREST) with the
// publishable key, i.e. as the anon role. The "Published catalog is publicly
// readable" RLS policy grants SELECT on every row, so this returns the same
// live catalog when the direct Postgres connection fails (for example a
// stale password in SUPABASE_DB_URL), instead of the 80-item AI archive.
// Writes still go through the Postgres pool only.
const REST_TIMEOUT_MS = 5000;

// fallow-ignore-next-line unused-export
export async function getPlantsViaRest() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_PUBLISHABLE_KEY || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    return null;
  }
  try {
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/plants?select=${PLANT_COLUMNS.join(',')}&order=created_at.desc`;
    const response = await fetch(endpoint, {
      headers: { apikey: publishableKey, accept: 'application/json' },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      throw new Error('unexpected response shape');
    }
    return rows.map(mapPlantRow);
  } catch (error) {
    console.error('Supabase REST getPlants failed:', error.message);
    return null;
  }
}

export async function getSupabasePlants() {
  const rows = await getPlantsViaPostgres();
  if (rows && rows.length > 0) {
    return rows;
  }
  return getPlantsViaRest();
}
