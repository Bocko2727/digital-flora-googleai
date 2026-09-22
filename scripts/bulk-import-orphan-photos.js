// scripts/bulk-import-orphan-photos.js  (ESM — matches "type": "module" in package.json)
//
// Reads the 33 already-uploaded, unused Supabase Storage objects (bucket
// "plant-images") from a fixed list (locked to the batch reviewed and
// approved on 2026-09-16 — do NOT re-scan storage.objects to avoid
// re-processing files already handled separately, e.g. File_017/File_023).
// For each file: downloads the existing bytes (NO re-upload), sends them to
// Gemini for identification, and inserts one new plants row via Supabase's
// PostgREST API directly (no @supabase/supabase-js dependency needed) that
// reuses the EXISTING filename as-is in photos[]. Every created record is
// intentionally left at whatever confidence Gemini reports — you are
// expected to review each one via the app's "🔍 Интерактивен QA Контрол"
// button afterwards.
//
// Run from the repo root inside the Codespace:
//   node --env-file=.env scripts/bulk-import-orphan-photos.js
//
// Required env vars (verify these EXACT names against your existing .env —
// this script does not import server.js, so double-check the Gemini key
// name matches what server.js actually reads):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (service role — needed to bypass RLS; NEVER
//                                 expose this key client-side)
//   GEMINI_API_KEY

import path from 'path';
import { GoogleGenAI } from '@google/genai';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    console.error('Missing required env var(s). Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY against your .env.');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const BUCKET = 'plant-images';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const PLANTS_REST_URL = `${SUPABASE_URL}/rest/v1/plants`;

// Fixed batch reviewed on 2026-09-16. Do not add/remove files here without
// re-checking storage.objects for unused entries first.
const FILES = [
    'IMG_5512.jpg','IMG_6256.JPG'
];

function mimeTypeFor(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpeg' || ext === '.jpg') return 'image/jpeg';
    return 'image/jpeg';
}

function confidenceLabel(score) {
    const pct = Math.round((typeof score === 'number' ? score : 0) * 100) + '%';
    if (score >= 0.8) return `Потвърдено (AI ${pct})`;
    if (score >= 0.4) return `Вероятно (AI ${pct})`;
    return `Неопределимо (AI ${pct})`;
}

async function fetchAsBase64(filename) {
    const res = await fetch(STORAGE_BASE + encodeURIComponent(filename));
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${filename}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
}

const PROMPT = `You are an expert botanist analyzing a plant photo for a Bulgarian digital herbarium catalog.
Respond with STRICT JSON only, no markdown, no extra text, matching exactly this shape:
{
  "likely_common_name_bg": string,
  "likely_scientific_name": string,
  "family": string,
  "confidence": number (0 to 1),
  "visible_features": string,
  "possible_lookalikes": string,
  "habitat": string,
  "benefits": string,
  "risks": string,
  "uses": string,
  "funFact": string,
  "additional_photos_needed": string
}
If you cannot identify the plant with confidence, still fill every field with your best estimate and use a low confidence value. Write all text field values in Bulgarian.`;

async function identifyWithGemini(base64, mimeType) {
    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: PROMPT }] }
    });
    const raw = response.text ? response.text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini did not return parseable JSON: ' + raw.slice(0, 200));
    return JSON.parse(jsonMatch[0]);
}

async function insertPlantRow(payload) {
    const res = await fetch(PLANTS_REST_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase insert failed (HTTP ${res.status}): ${text}`);
    }
    return res.json();
}

async function run() {
    let created = 0;
    const failed = [];

    for (const filename of FILES) {
        console.log(`\n[${created + failed.length + 1}/${FILES.length}] ${filename}`);
        try {
            const mimeType = mimeTypeFor(filename);
            const base64 = await fetchAsBase64(filename);
            const record = await identifyWithGemini(base64, mimeType);

            const payload = {
                common_name: record.likely_common_name_bg || 'Неопределено растение',
                latin_name: record.likely_scientific_name || 'Неопределен таксон',
                family: record.family || 'Семейство',
                photos: [filename],
                confidence: confidenceLabel(record.confidence),
                recognition: record.visible_features || 'Няма данни',
                habitat: record.habitat || 'Автоматично разпознато местообитание',
                lookalikes: record.possible_lookalikes || '-',
                benefits: record.benefits || 'Потенциална екологична роля',
                risks: record.risks || 'Внимание — непотвърдено от човек.',
                uses: record.uses || 'AI фотографско наблюдение',
                fun_fact: record.funFact || '-',
                author_email: 'bulk-import-script'
            };

            const inserted = await insertPlantRow(payload);
            console.log(`  -> created: ${payload.common_name} (${payload.latin_name}), confidence: ${payload.confidence}`);
            console.log(`  -> id: ${Array.isArray(inserted) ? inserted[0]?.id : inserted?.id}`);
            created += 1;
        } catch (err) {
            console.error(`  -> FAILED: ${err.message}`);
            failed.push(filename);
        }
        // small delay to be gentle with the Gemini API
        await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`\nDone. Created ${created}/${FILES.length}. Failed: ${failed.length ? failed.join(', ') : 'none'}.`);
    console.log('Every new record needs manual review via the app\'s QA verification button before being trusted as confirmed.');
}

run();
