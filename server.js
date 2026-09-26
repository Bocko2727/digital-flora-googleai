import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { GoogleGenAI } from '@google/genai';
import { getSupabasePlants, mapSupabaseConfidence } from './src/db/plants.js';
import { authenticateCatalogActor, requireCatalogWritePermission } from './src/auth/catalog-authorization.js';
import { appendSupabasePlantPhoto, deleteSupabasePlant, insertSupabasePlant, supabasePlantExists, updateSupabasePlant } from './src/db/supabase-catalog.js';
import { parsePlantImageDataUri, storePlantImage } from './src/storage/supabase-images.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_PUBLISHABLE_KEY || process.env.sb_publishable_Sdl2sYCMBSeAeW7tEpudKQ_zg0WfdUA_SUPABASE_ANON_KEY;
const supabaseOrigin = (() => {
  try { return supabaseUrl ? new URL(supabaseUrl).origin : null; } catch { return null; }
})();


app.set('trust proxy', 1);

// P1.1 (Ден 4 security hardening), completed: script-src no longer allows
// 'unsafe-inline'. index.html has no inline <script> blocks (they live in
// same-origin /theme-init.js and /app.js) and no inline on*="" handler
// attributes (app.js uses delegated addEventListener listeners keyed on
// data-action / data-change-action / data-input-action, plus a
// capture-phase 'error' listener for img[data-fallback]). script-src-attr
// is 'none' so any reintroduced inline handler fails loudly in the console
// instead of silently widening the policy. style-src keeps 'unsafe-inline'
// because inline style="" attributes are still used (out of scope).
// supabase-js is vendored locally (P2.3, vendor/supabase-js.umd.js) rather
// than imported at runtime from esm.sh, so script-src does not need that
// CDN origin. apis.google.com is the legacy Drive-picker loader (out of
// scope, left reachable rather than silently broken). connect-src/img-src
// include the Supabase project host because supabase-js talks to Supabase
// Auth/Storage directly from the browser.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://apis.google.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', ...(supabaseOrigin ? [supabaseOrigin] : [])],
      connectSrc: ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
}));


const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
const kiloApiKey = process.env.kilo_code || process.env.KILO_CODE || process.env.KILO_API_KEY || process.env.KILO_KEY;
const kiloBaseUrl = process.env.KILO_BASE_URL || 'https://api.kilo.ai/api/gateway';
const kiloModel = process.env.KILO_MODEL || 'kilo-auto';


const ai = new GoogleGenAI(apiKey ? { apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } } : { httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });


async function generateWithKiloAI(prompt, base64Image, mimeType) {
  if (!kiloApiKey) throw new Error('kilo_code / KILO_API_KEY не е зададен в системната среда.');
  const messages = [{ role: 'user', content: base64Image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}` } }] : prompt }];
  const baseUrlSanitized = kiloBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrlSanitized}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kiloApiKey}` }, body: JSON.stringify({ model: kiloModel, messages, temperature: 0.2 }) });
  if (!response.ok) { const errorText = await response.text(); throw new Error(`Kilo AI API грешка (${response.status}): ${errorText}`); }
  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}


function isGeminiOverloadedError(err) {
  const msg = err && err.message ? String(err.message) : '';
  return /"code"\s*:\s*503/.test(msg) || /UNAVAILABLE/.test(msg) || /high demand|overloaded/i.test(msg);
}

// Retries ONLY transient 503 "high demand" errors from Gemini, with
// exponential backoff (1s -> 2s -> 4s), max 3 attempts total. Any other
// error (including 429 quota-exhausted) is re-thrown immediately on the
// first attempt — retrying a daily quota error wastes time and does not
// help, per the free-tier RESOURCE_EXHAUSTED behaviour observed in
// production on 2026-09-16.
async function generateContentWithRetry(params, { maxAttempts = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      if (!isGeminiOverloadedError(err) || attempt === maxAttempts - 1) throw err;
      const delayMs = baseDelayMs * Math.pow(2, attempt); // 1000, 2000, 4000
      console.warn(`Gemini 503 (опит ${attempt + 1}/${maxAttempts}) — retry след ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}


const SAFE_FILENAME_RE = /^[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|svg|webp)$/i;
const ALLOWED_IMAGE_DIRS = [path.join(__dirname, 'images', 'review'), path.join(__dirname, 'images', 'herbarium'), path.join(__dirname, 'images', 'uploads')];
function getSafeBasename(rawName) { if (typeof rawName !== 'string' || !rawName) return null; const base = path.basename(rawName); return SAFE_FILENAME_RE.test(base) ? base : null; }
function isPathInsideDir(candidatePath, dirPath) { return candidatePath === dirPath || candidatePath.startsWith(dirPath + path.sep); }
function findSafeCandidateInDir(base, dir) { const resolvedDir = path.resolve(dir); const candidate = path.resolve(resolvedDir, base); if (!isPathInsideDir(candidate, resolvedDir)) return null; return fs.existsSync(candidate) ? candidate : null; }
function resolveSafeImagePath(rawName) { const base = getSafeBasename(rawName); if (!base) return null; return ALLOWED_IMAGE_DIRS.map((dir) => findSafeCandidateInDir(base, dir)).find(Boolean) || null; }


const ALLOWED_REMOTE_HOST = 'raw.githubusercontent.com';
const REMOTE_IMAGE_BASE_PATHS = ['', 'images/review/', 'images/herbarium/'];
const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;
function buildGithubImageUrls(base) { return REMOTE_IMAGE_BASE_PATHS.map((prefix) => `https://${ALLOWED_REMOTE_HOST}/Bocko2727/digitalflora/main/${prefix}${encodeURIComponent(base)}`); }
function isAcceptableImageResponse(fetchRes) { if (!fetchRes.ok) return false; const contentType = fetchRes.headers.get('content-type') || ''; return contentType.toLowerCase().startsWith('image/'); }
function isWithinSizeLimit(fetchRes, arrayBuffer) { const declaredLength = Number(fetchRes.headers.get('content-length') || 0); if (declaredLength && declaredLength > MAX_REMOTE_IMAGE_BYTES) return false; return arrayBuffer.byteLength <= MAX_REMOTE_IMAGE_BYTES; }
async function fetchImageCandidate(url) { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000); try { const fetchRes = await fetch(url, { redirect: 'error', signal: controller.signal }); if (!isAcceptableImageResponse(fetchRes)) return null; const arrayBuffer = await fetchRes.arrayBuffer(); if (!isWithinSizeLimit(fetchRes, arrayBuffer)) return null; return { buffer: Buffer.from(arrayBuffer), contentType: fetchRes.headers.get('content-type') }; } catch (e) { return null; } finally { clearTimeout(timeout); } }
async function findFirstImageCandidate(urls) { for (const url of urls) { const result = await fetchImageCandidate(url); if (result) return result; } return null; }
async function fetchAllowedGithubImage(rawName) { const base = getSafeBasename(rawName); if (!base) return null; return findFirstImageCandidate(buildGithubImageUrls(base)); }
function escapeXml(value) { return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }


const aiLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Твърде много заявки за AI анализ. Опитайте отново след няколко минути.' } });
const catalogReadLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Твърде много заявки към каталога. Опитайте отново по-късно.' } });
const moderateLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Твърде много заявки. Опитайте отново по-късно.' } });
const staticAssetLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Твърде много заявки. Опитайте отново по-късно.' } });
function isCatalogInputError(error) {
  return /Invalid plant id|Invalid taxonomy status|required|photos must|No supported/.test(error.message);
}


function forwardCatalogMutationError(res, next, error) {
  if (isCatalogInputError(error)) {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_PLANT_INPUT',
    });
  }
  return next(error);
}
// Largest legitimate body is one 5 MB image as base64 (~6.7 MB) plus JSON.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: true }));


// /theme-init.js and /app.js are the former inline <script> blocks of
// index.html, served as same-origin files so CSP script-src needs no
// 'unsafe-inline'.
const PUBLIC_ROOT_FILES = { '/manifest.json': path.join(__dirname, 'manifest.json'), '/icon.svg': path.join(__dirname, 'icon.svg'), '/sw.js': path.join(__dirname, 'sw.js'), '/theme-init.js': path.join(__dirname, 'theme-init.js'), '/app.js': path.join(__dirname, 'app.js') };
app.get(Object.keys(PUBLIC_ROOT_FILES), staticAssetLimiter, (req, res) => { res.sendFile(PUBLIC_ROOT_FILES[req.path], { dotfiles: 'deny' }); });

// P2.3: vendored @supabase/supabase-js UMD bundle (see vendor/supabase-js.umd.js
// header) served same-origin instead of a runtime esm.sh CDN import.
app.use('/vendor', staticAssetLimiter, express.static(path.join(__dirname, 'vendor'), { dotfiles: 'deny', index: false }));


app.use('/images', staticAssetLimiter, express.static(path.join(__dirname, 'images'), { dotfiles: 'deny', index: false }));


const uploadsDir = path.join(__dirname, 'images', 'uploads');
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) { console.warn('Внимание: Не може да се създаде папка uploads (възможно е read-only filesystem):', e.message); }


// Maps one AI-generated botanical-archive item (data/review-results.json)
// to the catalog shape. Optional text stays '' when absent — display
// fallbacks live in the UI only — and confidence goes through the same
// provenance-aware mapper as Supabase rows (never 'Потвърдено' for AI).
function archiveItemToPlant(item, idx) {
  const lookalikes = Array.isArray(item.possible_lookalikes) ? item.possible_lookalikes.join(', ') : (item.possible_lookalikes || '');
  return { id: `json_${idx}`, commonName: item.likely_common_name_bg || 'Неопределено растение', latinName: item.likely_scientific_name || 'Неопределен таксон', family: item.family || '', photos: [item.file || 'placeholder.jpg'], confidence: mapSupabaseConfidence(item.confidence), recognition: item.visible_features || '', habitat: item.habitat || '', lookalikes, benefits: item.benefits || '', risks: item.safety_note || item.risks || '', uses: item.uses || '', funFact: item.funFact || '', authorEmail: '', createdAt: item.analyzed_at || null };
}

// Sends the archive fallback list; returns false when the archive is missing.
// Sets X-Catalog-Source so the UI can tell the user it is not seeing the
// live Supabase catalog (records are read-only, ids are json_N).
function sendArchiveFallback(res) {
  const jsonPath = path.join(__dirname, 'data', 'review-results.json');
  if (!fs.existsSync(jsonPath)) return false;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  res.setHeader('X-Catalog-Source', 'archive-fallback');
  res.json((data.items || []).map(archiveItemToPlant));
  return true;
}


// REST CRUD for Plants. Supabase Postgres is the catalog source of truth
// for reads (Task 4); the JSON archive remains only as a documented
// fallback for when Supabase is unreachable or not yet configured.
app.get(['/api/plants', '/api/sql/plants'], catalogReadLimiter, async (req, res) => {
  try {
    const plantsList = await getSupabasePlants();
    if (plantsList && plantsList.length > 0) {
      res.setHeader('X-Catalog-Source', 'supabase');
      return res.json(plantsList);
    }
    if (sendArchiveFallback(res)) return;
    res.json([]);
  } catch (err) {
    console.error('Fetch plants error:', err);
    try {
      if (sendArchiveFallback(res)) return;
    } catch (e) { console.error('Archive fallback failed:', e.message); }
    res.status(500).json({ error: 'Грешка при извличане от базата данни' });
  }
});


app.post(['/api/plants', '/api/sql/plants'], moderateLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res, next) => {
  try {
    const plant = await insertSupabasePlant(req.body, req.catalogActor);
    return res.status(201).json({ success: true, plant });
  } catch (error) {
    return forwardCatalogMutationError(res, next, error);
  }
});


app.put('/api/plants/:id', moderateLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res, next) => {
  try {
    const plant = await updateSupabasePlant(req.params.id, req.body);
    if (!plant) return res.status(404).json({ error: 'Plant not found.', code: 'PLANT_NOT_FOUND' });
    return res.json({ success: true, plant });
  } catch (error) {
    return forwardCatalogMutationError(res, next, error);
  }
});


app.delete('/api/plants/:id', moderateLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res, next) => {
  try {
    const plant = await deleteSupabasePlant(req.params.id);
    if (!plant) return res.status(404).json({ error: 'Plant not found.', code: 'PLANT_NOT_FOUND' });
    return res.json({ success: true });
  } catch (error) {
    return forwardCatalogMutationError(res, next, error);
  }
});


// AI endpoints call a paid/credit-consuming provider (CLAUDE.md §4.12), so
// they are restricted to catalog editors/admins, same as catalog writes.
app.post('/api/qa', aiLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res) => {
  const { filename, claimedName, latinName } = req.body;
  if (!filename) return res.status(400).json({ error: 'Липсва файл' });
  let base64 = null;
  let mimeType = typeof filename === 'string' && filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const localPath = resolveSafeImagePath(filename);
  if (localPath) base64 = fs.readFileSync(localPath).toString('base64');
  if (!base64) { const remote = await fetchAllowedGithubImage(filename); if (remote) { base64 = remote.buffer.toString('base64'); mimeType = remote.contentType || mimeType; } }
  if (!base64 && typeof filename === 'string' && filename.startsWith('data:image')) {
    try { const parsed = parsePlantImageDataUri(filename); mimeType = parsed.mimeType; base64 = parsed.buffer.toString('base64'); } catch (e) { return res.status(400).json({ error: 'Снимката трябва да е JPEG, PNG или WebP до 5 MB.', code: 'INVALID_IMAGE' }); }
  }
  if (!base64) return res.status(404).json({ error: 'Снимката не е намерена' });
  const prompt = `You are an expert botanist performing Quality Assurance. Look at this image carefully. Is this plant really "${claimedName}" (${latinName})? Answer YES or NO (strictly start your verdict with YES or NO), and provide a short 1-2 sentence explanation in Bulgarian.`;
  try {
    let verdict = '';
    try {
      const response = await generateContentWithRetry({ model: 'gemini-3.6-flash', contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: prompt }] } });
      verdict = response.text ? response.text.trim() : 'Няма отговор от AI.';
    } catch (geminiErr) {
      if (kiloApiKey) { console.log('Gemini QA failed, falling back to Kilo AI:', geminiErr.message); verdict = await generateWithKiloAI(prompt, base64, mimeType); } else { throw geminiErr; }
    }
    res.json({ verdict });
  } catch (error) { console.error('QA Error:', error); res.status(500).json({ error: error.message || 'Грешка при AI верификацията.' }); }
});


app.post('/api/upload', aiLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Няма качена снимка.' });
  let parsed;
  // Same validation as Storage uploads: JPEG/PNG/WebP only, magic bytes
  // must match, max 5 MB. The on-disk extension comes from the validated
  // MIME type, never from the client, so no .html/.svg can be written into
  // the publicly served images/ directory.
  try { parsed = parsePlantImageDataUri(image); } catch (e) { return res.status(400).json({ error: 'Снимката трябва да е JPEG, PNG или WebP до 5 MB.', code: 'INVALID_IMAGE' }); }
  try {
    const { buffer, mimeType, extension } = parsed;
    const base64Image = buffer.toString('base64');
    const fileName = `plant_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);
    let relativeUrl = '';
    try { fs.writeFileSync(filePath, buffer); relativeUrl = `images/uploads/${fileName}`; } catch (e) { console.warn('Could not save file to disk (read-only FS), proceeding with AI analysis only:', e.message); relativeUrl = ''; }
    const prompt = `You are an expert botanist. Analyze this plant image and provide the following details in Bulgarian in strict JSON format:{\n  "likely_scientific_name": "Latin name",\n  "likely_common_name_bg": "Bulgarian name",\n  "family": "Botanical family in Latin or Bulgarian",\n  "confidence": 0.9,\n  "identification_level": "species",\n  "visible_features": "Description in Bulgarian",\n  "possible_lookalikes": "Similar plants",\n  "safety_note": "Toxicity or warnings in Bulgarian",\n  "additional_photos_needed": "What else to photograph for better ID"\n}`;
    let aiData;
    try {
      const response = await generateContentWithRetry({ model: 'gemini-3.6-flash', contents: { parts: [{ inlineData: { data: base64Image, mimeType } }, { text: prompt }] }, config: { responseMimeType: "application/json" } });
      aiData = JSON.parse(response.text);
    } catch (geminiErr) {
      if (kiloApiKey) { console.log('Gemini recognition failed, attempting Kilo AI:', geminiErr.message); const textResult = await generateWithKiloAI(prompt + "\nReturn ONLY raw JSON without markdown backticks.", base64Image, mimeType); const cleanedText = textResult.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim(); aiData = JSON.parse(cleanedText); } else { throw geminiErr; }
    }
    aiData.analyzed_at = new Date().toISOString();
    res.json({ success: true, record: aiData, imageUrl: relativeUrl });
  } catch (error) { console.error('Upload Error:', error); res.status(500).json({ error: error.message || 'Грешка при анализа на снимката.' }); }
});


app.get('/api/ai/status', (req, res) => { res.json({ geminiConfigured: !!apiKey, kiloConfigured: !!kiloApiKey, kiloModel: kiloModel }); });


// Public, read-only config for the browser to bootstrap Supabase Auth.
// Only ever returns the publishable (anon-equivalent) key, never the
// service-role key or any other secret.
app.get('/api/config', staticAssetLimiter, (req, res) => {
  res.json({
    supabaseUrl: supabaseUrl || null,
    supabasePublishableKey: supabasePublishableKey || null,
    supabaseStorageBaseUrl: supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/plant-images/` : null,
  });
});


// Convenience-only endpoint so the UI can display the caller's own role.
// Reuses the same Task 6 authorization middleware; grants no additional
// access and does not bypass requireCatalogWritePermission on writes.
app.get('/api/auth/whoami', moderateLimiter, authenticateCatalogActor, (req, res) => {
  res.json({ id: req.catalogActor.id, email: req.catalogActor.email, role: req.catalogActor.role });
});


// Secure local photo upload: editor/admin only, validated server-side,
// stored in Supabase Storage under a plant-scoped object key, then
// appended to the plant's existing photos array. Anonymous -> 401,
// viewer -> 403 (enforced by the same Task 6 middleware used for /api/plants).
app.post('/api/plants/:id/photos', moderateLimiter, authenticateCatalogActor, requireCatalogWritePermission, async (req, res, next) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided.', code: 'IMAGE_REQUIRED' });


    let exists;
    try { exists = await supabasePlantExists(req.params.id); } catch (dbError) {
      if (/Invalid plant id/.test(dbError.message)) throw dbError;
      console.error('Photo upload: plant lookup failed:', dbError.message);
      return res.status(502).json({ error: 'Catalog database is temporarily unavailable.', code: 'DATABASE_UNAVAILABLE' });
    }
    if (!exists) return res.status(404).json({ error: 'Plant not found.', code: 'PLANT_NOT_FOUND' });


    const stored = await storePlantImage(req.params.id, image);
    let updatedPlant;
    try { updatedPlant = await appendSupabasePlantPhoto(req.params.id, stored.imageUrl); } catch (dbError) {
      // The Storage object already exists; it is NOT deleted here (storage
      // deletes need explicit approval). Log the key so it can be traced.
      console.error('Photo upload: stored %s but could not attach it to plant %s: %s', stored.objectKey, req.params.id, dbError.message);
      return res.status(502).json({ error: 'Image was stored but could not be attached to the plant.', code: 'PHOTO_ATTACH_FAILED' });
    }
    if (!updatedPlant) {
      console.error('Photo upload: stored %s but plant %s disappeared before attach.', stored.objectKey, req.params.id);
      return res.status(404).json({ error: 'Plant not found.', code: 'PLANT_NOT_FOUND' });
    }


    return res.status(201).json({ success: true, imageUrl: stored.imageUrl, objectKey: stored.objectKey, plant: updatedPlant });
  } catch (error) {
    if (/Invalid image|Invalid plant id|MB after decoding|does not match its declared/.test(error.message)) {
      return res.status(400).json({ error: error.message, code: 'INVALID_IMAGE' });
    }
    if (/Storage server configuration|persist image/.test(error.message)) {
      return res.status(502).json({ error: 'Image storage is temporarily unavailable.', code: 'STORAGE_UNAVAILABLE' });
    }
    return next(error);
  }
});


// Fallback for missing images: only ever resolves against the fixed
// allowlisted image directories or the SSRF-safe remote fetch helper.
// Never joins raw req.path onto __dirname.
app.use(staticAssetLimiter, async (req, res, next) => {
  if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(req.path)) return next();
  const filename = path.basename(req.path);
  const localPath = resolveSafeImagePath(filename);
  if (localPath) return res.sendFile(localPath);
  const remote = await fetchAllowedGithubImage(filename);
  if (remote) { res.setHeader('Content-Type', remote.contentType); res.setHeader('Cache-Control', 'public, max-age=86400'); return res.send(remote.buffer); }
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#dde4dc"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#667067" text-anchor="middle" dy=".3em">Снимката липсва</text><text x="50%" y="58%" font-family="monospace" font-size="12" fill="#888" text-anchor="middle">${escapeXml(filename)}</text></svg>`);
});


app.get(['/health', '/healthz'], (req, res) => { res.status(200).json({ status: 'ok', uptime: process.uptime() }); });


app.get('/', staticAssetLimiter, (req, res) => { res.sendFile(path.join(__dirname, 'index.html'), { dotfiles: 'deny' }); });


app.use((err, req, res, next) => { console.error('Unhandled Express error:', err); if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' }); });


export default app;

if (!process.env.VERCEL) {
  const HOST = '0.0.0.0';
  const server = app.listen(PORT, HOST, () => { console.log(`Server running at http://${HOST}:${PORT}`); });

  process.on('SIGTERM', () => { console.log('SIGTERM signal received: closing HTTP server'); server.close(() => { console.log('HTTP server closed'); process.exit(0); }); });
  process.on('SIGINT', () => { console.log('SIGINT signal received: closing HTTP server'); server.close(() => { console.log('HTTP server closed'); process.exit(0); }); });
}
