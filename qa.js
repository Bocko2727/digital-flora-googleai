import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({});

const findImageAsBase64 = async (filename) => {
  const localPaths = [
    path.join(__dirname, filename),
    path.join(__dirname, 'images', 'review', filename),
    path.join(__dirname, 'images', 'herbarium', filename)
  ];
  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      console.log(`Found locally: ${p}`);
      return fs.readFileSync(p).toString('base64');
    }
  }
  // Try Github
  const githubPaths = [
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/${filename}`,
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/review/${filename}`,
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/herbarium/${filename}`
  ];
  for (const url of githubPaths) {
    try {
      console.log(`Fetching: ${url}`);
      const fetchRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (fetchRes.ok) {
        console.log(`Fetched successfully: ${url}`);
        const arrayBuffer = await fetchRes.arrayBuffer();
        return Buffer.from(arrayBuffer).toString('base64');
      }
    } catch (e) {
      console.log(`Fetch failed: ${url}`);
    }
  }
  return null;
};

const checkPlant = async (filename, claimedName, latinName) => {
  const base64 = await findImageAsBase64(filename);
  if (!base64) {
    return `Skipped - Image not found for ${filename}`;
  }
  
  const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const prompt = `You are an expert botanist performing Quality Assurance.
Look at this image.
Is this plant really "${claimedName}" (${latinName})?
Answer YES or NO (strictly start your verdict with YES or NO), and provide a short 1-2 sentence explanation in Bulgarian.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        { role: 'user', parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt }
        ]}
      ]
    });
    return response.text.trim();
  } catch (err) {
    return `Error: ${err.message}`;
  }
};

async function runQA() {
  const allRecords = [];
  
  // Load review-results.json
  if (fs.existsSync('data/review-results.json')) {
    const data = JSON.parse(fs.readFileSync('data/review-results.json', 'utf8'));
    const items = Array.isArray(data) ? data : (data.items || data.results || []);
    allRecords.push(...items);
  }
  
  // Load review-batch-c189987.json
  if (fs.existsSync('data/review-batch-c189987.json')) {
    const data = JSON.parse(fs.readFileSync('data/review-batch-c189987.json', 'utf8'));
    const items = Array.isArray(data) ? data : (data.items || data.results || []);
    allRecords.push(...items);
  }
  
  let report = "QA БОТАНИЧЕСКИ ДОКЛАД\n====================\n\n";
  let count = 0;
  
  const tasks = allRecords.map(record => {
    const file = record.file_name || record.filename || record.file || record.source;
    if (!file) return null;
    
    count++;
    const bgName = record.bulgarian_name || record.likely_common_name_bg || record.commonNameBg || record.name || 'Неопределено';
    const latinName = record.latin_name || record.likely_scientific_name || record.scientificName || 'Неопределен';
    
    return { file, bgName, latinName, record };
  }).filter(Boolean);

  console.log(`Starting QA for ${tasks.length} images...`);
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    console.log(`Processing ${i + 1}/${tasks.length}: ${t.file}...`);
    const verdict = await checkPlant(t.file, t.bgName, t.latinName);
    const entry = `[Снимка]: ${t.file}\n[Име]: ${t.bgName} (${t.latinName})\n[Статус]: ${verdict.split('\\n')[0]}\n\n`;
    report += entry;
    fs.writeFileSync('qa-report.txt', report);
    
    if (i < tasks.length - 1) {
      console.log('Waiting 15 seconds to respect rate limits...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
  console.log('QA completed. Saved to qa-report.txt');
}

runQA();

