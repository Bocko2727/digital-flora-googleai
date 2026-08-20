import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { getOrCreateUser, getUsers } from './src/db/users.js';
import { seedPlantsIfEmpty, getSqlPlants, insertSqlPlant, updateSqlPlant, deleteSqlPlant } from './src/db/plants.js';
import { logDriveImport, getDriveImports } from './src/db/drive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve static assets from project root
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(__dirname));

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'images', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Внимание: Не може да се създаде папка uploads (възможно е read-only filesystem):', e.message);
}

// REST CRUD for Plants (Cloud SQL + JSON fallback)
app.get(['/api/plants', '/api/sql/plants'], async (req, res) => {
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

app.post(['/api/plants', '/api/sql/plants'], async (req, res) => {
  try {
    const newPlant = await insertSqlPlant(req.body);
    res.json({ success: true, plant: newPlant });
  } catch (err) {
    console.error('Insert SQL plant error:', err);
    res.status(500).json({ error: err.message || 'Грешка при запис в базата данни' });
  }
});

app.put('/api/plants/:id', async (req, res) => {
  try {
    const updated = await updateSqlPlant(req.params.id, req.body);
    res.json({ success: true, plant: updated });
  } catch (err) {
    console.error('Update SQL plant error:', err);
    res.status(500).json({ error: err.message || 'Грешка при обновяване в базата данни' });
  }
});

app.delete('/api/plants/:id', async (req, res) => {
  try {
    await deleteSqlPlant(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete SQL plant error:', err);
    res.status(500).json({ error: err.message || 'Грешка при изтриване от базата данни' });
  }
});

// QA API
app.post('/api/qa', async (req, res) => {
  const { filename, claimedName, latinName } = req.body;
  if (!filename) return res.status(400).json({error: 'Липсва файл'});

  let base64 = null;
  let mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const cleanFilename = path.basename(filename);
  
  const localPaths = [
    path.join(__dirname, cleanFilename),
    path.join(__dirname, 'images', 'review', cleanFilename),
    path.join(__dirname, 'images', 'herbarium', cleanFilename),
    path.join(__dirname, 'images', 'uploads', cleanFilename)
  ];
  
  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      base64 = fs.readFileSync(p).toString('base64');
      break;
    }
  }
  
  if (!base64) {
    const githubPaths = [
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/${cleanFilename}`,
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/review/${cleanFilename}`,
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/herbarium/${cleanFilename}`
    ];
    for (const url of githubPaths) {
      try {
        const fetchRes = await fetch(url);
        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          base64 = Buffer.from(arrayBuffer).toString('base64');
          break;
        }
      } catch (e) {}
    }
  }

  // Fallback if the photo string itself is base64
  if (!base64 && filename.startsWith('data:image')) {
     const match = filename.match(/^data:(image\/\w+);base64,(.*)$/);
     if (match) {
         mimeType = match[1];
         base64 = match[2];
     }
  }

  if (!base64) return res.status(404).json({error: 'Снимката не е намерена'});

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

// Upload & AI Recognition API
app.post('/api/upload', async (req, res) => {
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
app.post('/api/users/sync', async (req, res) => {
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
app.post('/api/drive/log', async (req, res) => {
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

// Fallback for missing images
app.use(async (req, res, next) => {
  if (req.path.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
    const filename = path.basename(req.path);
    
    // Check locally first
    const possiblePaths = [
      path.join(__dirname, req.path), 
      path.join(__dirname, filename),
      path.join(__dirname, 'images', 'review', filename),
      path.join(__dirname, 'images', 'herbarium', filename),
      path.join(__dirname, 'images', 'uploads', filename)
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return res.sendFile(p);
      }
    }

    // Try multiple GitHub paths
    const githubPaths = [
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main${req.path}`,
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/${filename}`,
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/review/${filename}`,
      `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/herbarium/${filename}`
    ];

    for (const url of githubPaths) {
      try {
        const fetchRes = await fetch(url);
        if (fetchRes.ok) {
          res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const arrayBuffer = await fetchRes.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      } catch (e) {}
    }

    // Fallback SVG placeholder
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#dde4dc"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#667067" text-anchor="middle" dy=".3em">Снимката липсва</text><text x="50%" y="58%" font-family="monospace" font-size="12" fill="#888" text-anchor="middle">${filename}</text></svg>`);
  }
  next();
});

// Health checks for Cloud Run & load balancers
app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
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
