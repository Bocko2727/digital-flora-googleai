import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { getOrCreateUser, getUsers } from './src/db/users.js';
import { seedPlantsIfEmpty, getSqlPlants } from './src/db/plants.js';
import { logDriveImport, getDriveImports } from './src/db/drive.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Trust exactly one proxy hop (Vercel/Cloud Run edge). Does not blindly
// trust an arbitrary chain of forwarded headers.
app.set('trust proxy', 1);


// Initialize Gemini and Kilo AI with environment keys
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
const kiloApiKey = process.env.kilo_code || process.env.KILO_CODE || process.env.KILO_API_KEY || process.env.KILO_KEY;
const kiloBaseUrl = process.env.KILO_BASE_URL || 'https://api.kilo.ai/api/gateway';
const kiloModel = process.env.KILO_MODEL || 'kilo-auto';


const ai = new GoogleGenAI(apiKey ? {
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
} : {
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});


// Helper for Kilo AI API Gateway (OpenAI compatible format)
async function generateWithKiloAI(prompt, base64Image, mimeType) {
  if (!kiloApiKey) {
    throw new Error('kilo_code / KILO_API_KEY не е зададен в системната среда.');
  }


  const messages = [
    {
      role: 'user',
      content: base64Image ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}` } }
      ] : prompt
    }
  ];


  const baseUrlSanitized = kiloBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrlSanitized}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kiloApiKey}`
    },
    body: JSON.stringify({
      model: kiloModel,
      messages: messages,
      temperature: 0.2
    })
  });


  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kilo AI API грешка (${response.status}): ${errorText}`);
  }


  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}


// ---------------------------------------------------------------------------
// Security helpers: safe filenames, path resolution, SSRF-safe remote fetch,
// XML escaping and a dependency-free rate limiter.
// ---------------------------------------------------------------------------

const SAFE_FILENAME_RE = /^[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|svg|webp)$/i;

const ALLOWED_IMAGE_DIRS = [
  path.join(__dirname, 'images', 'review'),
  path.join(__dirname, 'images', 'herbarium'),
  path.join(__dirname, 'images', 'uploads'),
];

function getSafeBasename(rawName) {
  if (typeof rawName !== 'string' || !rawName) return null;
  const base = path.basename(rawName);
  return SAFE_FILENAME_RE.test(base) ? base : null;
}

function isPathInsideDir(candidatePath, dirPath) {
  return candidatePath === dirPath || candidatePath.startsWith(dirPath + path.sep);
}

function findSafeCandidateInDir(base, dir) {
  const resolvedDir = path.resolve(dir);
  const candidate = path.resolve(resolvedDir, base);
  if (!isPathInsideDir(candidate, resolvedDir)) return null;
  return fs.existsSync(candidate) ? candidate : null;
}

// Resolves a user-supplied filename to a real file strictly inside one of
// ALLOWED_IMAGE_DIRS. Rejects traversal, separators, malformed names and
// disallowed extensions. Never joins raw request paths onto __dirname.
function resolveSafeImagePath(rawName) {
  const base = getSafeBasename(rawName);
  if (!base) return null;
  return ALLOWED_IMAGE_DIRS.map((dir) => findSafeCandidateInDir(base, dir)).find(Boolean) || null;
}

// SSRF-safe remote image fetch: fixed host, path-encoded filename only,
// no redirect following, timeout and size/content-type enforcement.
const ALLOWED_REMOTE_HOST = 'raw.githubusercontent.com';
const REMOTE_IMAGE_BASE_PATHS = [
  '',
  'images/review/',
  'images/herbarium/',
];
const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

function buildGithubImageUrls(base) {
  return REMOTE_IMAGE_BASE_PATHS.map(
    (prefix) => `https://${ALLOWED_REMOTE_HOST}/Bocko2727/digitalflora/main/${prefix}${encodeURIComponent(base)}`
  );
}

function isAcceptableImageResponse(fetchRes) {
  if (!fetchRes.ok) return false;
  const contentType = fetchRes.headers.get('content-type') || '';
  return contentType.toLowerCase().startsWith('image/');
}

function isWithinSizeLimit(fetchRes, arrayBuffer) {
  const declaredLength = Number(fetchRes.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_REMOTE_IMAGE_BYTES) return false;
  return arrayBuffer.byteLength <= MAX_REMOTE_IMAGE_BYTES;
}

async function fetchImageCandidate(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const fetchRes = await fetch(url, { redirect: 'error', signal: controller.signal });
    if (!isAcceptableImageResponse(fetchRes)) return null;

    const arrayBuffer = await fetchRes.arrayBuffer();
    if (!isWithinSizeLimit(fetchRes, arrayBuffer)) return null;

    return { buffer: Buffer.from(arrayBuffer), contentType: fetchRes.headers.get('content-type') };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findFirstImageCandidate(urls) {
  for (const url of urls) {
    const result = await fetchImageCandidate(url);
    if (result) return result;
  }
  return null;
}

async function fetchAllowedGithubImage(rawName) {
  const base = getSafeBasename(rawName);
  if (!base) return null;
  return findFirstImageCandidate(buildGithubImageUrls(base));
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// Minimal in-memory sliding-window rate limiter (no new npm dependency, so
// npm ci / package-lock stay unaffected). Suitable for a single-instance
// deployment; safe to swap for a shared-store limiter later if scaled out.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({ error: message || 'Твърде много заявки. Опитайте отново по-късно.' });
    }
    return next();
  };
}

const aiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, max: 8,
  message: 'Твърде много заявки за AI анализ. Опитайте отново след няколко минути.',
});
const catalogReadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, max: 300,
  message: 'Твърде много заявки към каталога. Опитайте отново по-късно.',
});
const moderateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, max: 30,
  message: 'Твърде много заявки. Опитайте отново по-късно.',
});

// Temporary migration-safe response for legacy Cloud SQL catalog writes.
// These routes currently have no server-side auth/role check, so they are
// disabled until Supabase JWT + role validation lands (Task 5).
function catalogWriteDisabled(req, res) {
  res.status(403).json({
    error: 'Catalog write operations are temporarily disabled pending Supabase-authenticated write migration.',
    code: 'CATALOG_WRITE_DISABLED',
  });
}


// ---------------------------------------------------------------------------
// Middleware and safe static asset serving
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Only these exact root files are ever served directly; everything else in
// the project root (.env, server.js, package.json, src/, data/, supabase/,
// scripts/, tests/) stays unreachable via HTTP.
const PUBLIC_ROOT_FILES = {
  '/manifest.json': path.join(__dirname, 'manifest.json'),
  '/icon.svg': path.join(__dirname, 'icon.svg'),
  '/sw.js': path.join(__dirname, 'sw.js'),
};
app.get(Object.keys(PUBLIC_ROOT_FILES), (req, res) => {
  res.sendFile(PUBLIC_ROOT_FILES[req.path], { dotfiles: 'deny' });
});

// Only the images directory is served as a static tree, with dotfiles denied
// and directory listing disabled.
app.use('/images', express.static(path.join(__dirname, 'images'), {
  dotfiles: 'deny',
  index: false,
}));


// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'images', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Внимание: Не може да се създаде папка uploads (възможно е read-only filesystem):', e.message);
}


// REST CRUD for Plants (Cloud SQL + JSON fallback). Reads remain public;
// writes are disabled below until Supabase-authenticated writes land.
app.get(['/api/plants', '/api/sql/plants'], catalogReadLimiter, async (req, res) => {
  try {
    const plantsList = await getSqlPlants();
    if (plantsList && plantsList.length > 0) {
      return res.json(plantsList);
    }

    // Fallback to review-results.json if DB query returned 0
    const jsonPath = path.join(__dirname, 'data', 'review-results.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const items = (data.items || []).map((item, idx) => ({
        id: `json_${idx}`,
        commonName: item.likely_common_name_bg || 'Неопределено растение',
        latinName: item.likely_scientific_name || 'Неопределен таксон',
        family: item.family || 'Семейство',
        photos: [item.file || 'placeholder.jpg'],
        confidence: item.confidence === 'high' ? 'Потвърдено (Ботанически архив)' : item.confidence === 'low' ? 'Неопределимо (Ботанически архив)' : 'Вероятно (Ботанически архив)',
        recognition: item.visible_features || 'Няма допълнителни данни',
        habitat: item.habitat || 'Ботанически образец от България',
        lookalikes: Array.isArray(item.possible_lookalikes) ? item.possible_lookalikes.join(', ') : (item.possible_lookalikes || '-'),
        benefits: item.benefits || 'Ботаническо и флористично значение за биоразнообразието.',
        risks: item.safety_note || item.risks || 'Няма регистрирани критични рискове.',
        uses: item.uses || 'Хербариен образец и ботаническо наблюдение.',
        funFact: item.funFact || item.additional_photos_needed || 'Изисква се наблюдение в период на активен цъфтеж.',
        authorEmail: 'digitalflora@botany.bg',
        createdAt: item.analyzed_at || new Date().toISOString()
      }));
      return res.json(items);
    }
    res.json([]);
  } catch (err) {
    console.error('Fetch plants error:', err);
    // Fallback to review-results.json on DB connection error
    try {
      const jsonPath = path.join(__dirname, 'data', 'review-results.json');
      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const items = (data.items || []).map((item, idx) => ({
          id: `json_${idx}`,
          commonName: item.likely_common_name_bg || 'Неопределено растение',
          latinName: item.likely_scientific_name || 'Неопределен таксон',
          family: item.family || 'Семейство',
          photos: [item.file || 'placeholder.jpg'],
          confidence: item.confidence === 'high' ? 'Потвърдено (Ботанически архив)' : item.confidence === 'low' ? 'Неопределимо (Ботанически архив)' : 'Вероятно (Ботанически архив)',
          recognition: item.visible_features || 'Няма допълнителни данни',
          habitat: item.habitat || 'Ботанически образец от България',
          lookalikes: Array.isArray(item.possible_lookalikes) ? item.possible_lookalikes.join(', ') : (item.possible_lookalikes || '-'),
          benefits: item.benefits || 'Ботаническо и флористично значение за биоразнообразието.',
          risks: item.safety_note || item.risks || 'Няма регистрирани критични рискове.',
          uses: item.uses || 'Хербариен образец и ботаническо наблюдение.',
          funFact: item.funFact || item.additional_photos_needed || 'Изисква се наблюдение в период на активен цъфтеж.',
          authorEmail: 'digitalflora@botany.bg',
          createdAt: item.analyzed_at || new Date().toISOString()
        }));
        return res.json(items);
      }
    } catch (e) {}
    res.status(500).json({ error: err.message || 'Грешка при извличане от базата данни' });
  }
});

app.post(['/api/plants', '/api/sql/plants'], moderateLimiter, catalogWriteDisabled);
app.put('/api/plants/:id', moderateLimiter, catalogWriteDisabled);
app.delete('/api/plants/:id', moderateLimiter, catalogWriteDisabled);


// QA API — strictly rate limited (invokes AI). Image lookup now goes only
// through the safe local resolver and the SSRF-safe remote fetch helper.
app.post('/api/qa', aiLimiter, async (req, res) => {
  const { filename, claimedName, latinName } = req.body;
  if (!filename) return res.status(400).json({ error: 'Липсва файл' });

  let base64 = null;
  let mimeType = typeof filename === 'string' && filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const localPath = resolveSafeImagePath(filename);
  if (localPath) {
    base64 = fs.readFileSync(localPath).toString('base64');
  }

  if (!base64) {
    const remote = await fetchAllowedGithubImage(filename);
    if (remote) {
      base64 = remote.buffer.toString('base64');
      mimeType = remote.contentType || mimeType;
    }
  }

  // Fallback if the photo string itself is base64
  if (!base64 && typeof filename === 'string' && filename.startsWith('data:image')) {
    const match = filename.match(/^data:(image\/\w+);base64,(.*)$/);
    if (match) {
      mimeType = match[1];
      base64 = match[2];
    }
  }

  if (!base64) return res.status(404).json({ error: 'Снимката не е намерена' });

  const prompt = `You are an expert botanist performing Quality Assurance. Look at this image carefully. Is this plant really "${claimedName}" (${latinName})? Answer YES or NO (strictly start your verdict with YES or NO), and provide a short 1-2 sentence explanation in Bulgarian.`;

  try {
    let verdict = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: prompt }
          ]
        }
      });
      verdict = response.text ? response.text.trim() : 'Няма отговор от AI.';
    } catch (geminiErr) {
      if (kiloApiKey) {
        console.log('Gemini QA failed, falling back to Kilo AI:', geminiErr.message);
        verdict = await generateWithKiloAI(prompt, base64, mimeType);
      } else {
        throw geminiErr;
      }
    }

    res.json({ verdict });
  } catch (error) {
    console.error('QA Error:', error);
    res.status(500).json({ error: error.message || 'Грешка при AI верификацията.' });
  }
});


// Upload & AI Recognition API — strictly rate limited (invokes AI).
app.post('/api/upload', aiLimiter, async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Няма качена снимка.' });
  }

  try {
    const match = image.match(/^data:(image\/(\w+));base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ error: 'Невалиден файлов формат.' });
    }
    const mimeType = match[1];
    let ext = match[2] || 'jpg';
    if (ext === 'jpeg') ext = 'jpg';
    const base64Image = match[3];

    // Save image to disk in uploads directory
    const fileName = `plant_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    let relativeUrl = '';
    try {
      fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
      relativeUrl = `images/uploads/${fileName}`;
    } catch (e) {
      console.warn('Could not save file to disk (read-only FS), proceeding with AI analysis only:', e.message);
      // Persistent image storage will be added through the approved Supabase Storage migration; until then, omit the local URL on read-only filesystems.
      relativeUrl = '';
    }

    const prompt = `You are an expert botanist. Analyze this plant image and provide the following details in Bulgarian in strict JSON format:{
  "likely_scientific_name": "Latin name",
  "likely_common_name_bg": "Bulgarian name",
  "family": "Botanical family in Latin or Bulgarian",
  "confidence": 0.9,
  "identification_level": "species",
  "visible_features": "Description in Bulgarian",
  "possible_lookalikes": "Similar plants",
  "safety_note": "Toxicity or warnings in Bulgarian",
  "additional_photos_needed": "What else to photograph for better ID"
}`;

    let aiData;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });
      aiData = JSON.parse(response.text);
    } catch (geminiErr) {
      if (kiloApiKey) {
        console.log('Gemini recognition failed, attempting Kilo AI:', geminiErr.message);
        const textResult = await generateWithKiloAI(prompt + "\nReturn ONLY raw JSON without markdown backticks.", base64Image, mimeType);
        const cleanedText = textResult.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        aiData = JSON.parse(cleanedText);
      } else {
        throw geminiErr;
      }
    }

    aiData.analyzed_at = new Date().toISOString();

    res.json({ success: true, record: aiData, imageUrl: relativeUrl, base64: image });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Грешка при анализа на снимката.' });
  }
});


// Sync User to Cloud SQL PostgreSQL
app.post('/api/users/sync', moderateLimiter, async (req, res) => {
  try {
    const { uid, email, displayName, photoUrl } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ error: 'Липсва uid или email' });
    }
    const user = await getOrCreateUser(uid, email, displayName, photoUrl);
    res.json({ success: true, user });
  } catch (err) {
    console.error('User sync error:', err);
    res.status(500).json({ error: err.message || 'Грешка при синхронизация на потребител' });
  }
});


// Cloud SQL Drive Import Logger
app.post('/api/drive/log', moderateLimiter, async (req, res) => {
  try {
    const { fileId, fileName, mimeType, userUid } = req.body;
    if (!fileId || !fileName) {
      return res.status(400).json({ error: 'Липсва fileId или fileName' });
    }
    const log = await logDriveImport(fileId, fileName, mimeType, userUid);
    res.json({ success: true, log });
  } catch (err) {
    console.error('Drive log error:', err);
    res.status(500).json({ error: err.message || 'Грешка при запис на Drive импорт' });
  }
});


// AI Provider Status endpoint
app.get('/api/ai/status', (req, res) => {
  res.json({
    geminiConfigured: !!apiKey,
    kiloConfigured: !!kiloApiKey,
    kiloModel: kiloModel
  });
});


// Fallback for missing images: only ever resolves against the fixed
// allowlisted image directories or the SSRF-safe remote fetch helper.
// Never joins raw req.path onto __dirname.
app.use(async (req, res, next) => {
  if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(req.path)) return next();

  const filename = path.basename(req.path);

  const localPath = resolveSafeImagePath(filename);
  if (localPath) {
    return res.sendFile(localPath);
  }

  const remote = await fetchAllowedGithubImage(filename);
  if (remote) {
    res.setHeader('Content-Type', remote.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(remote.buffer);
  }

  // Fallback SVG placeholder — filename is XML-escaped before interpolation.
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#dde4dc"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#667067" text-anchor="middle" dy=".3em">Снимката липсва</text><text x="50%" y="58%" font-family="monospace" font-size="12" fill="#888" text-anchor="middle">${escapeXml(filename)}</text></svg>`);
});


// Health checks for Cloud Run & load balancers — never rate limited.
app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), { dotfiles: 'deny' });
});


// Global error handler — never reflects untrusted content back as HTML.
app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  // Run non-blocking seed in background
  seedPlantsIfEmpty().catch(e => {
    console.error('Background seed error:', e);
  });
});


process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});


process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
