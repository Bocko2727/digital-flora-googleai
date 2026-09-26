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

export async function getSupabasePlants() {
  if (!supabasePool) {
    return null;
  }
  try {
    const { rows } = await supabasePool.query(
      `SELECT id, common_name, latin_name, family, photos, confidence, recognition,
              habitat, lookalikes, benefits, risks, uses, fun_fact, author_email, taxonomy_status, created_at
       FROM public.plants
       ORDER BY created_at DESC`
    );
    return rows.map((r) => ({
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
    }));
  } catch (error) {
    console.error('Supabase getPlants failed:', error.message);
    return null;
  }
}
