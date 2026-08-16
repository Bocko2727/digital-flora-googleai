import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { plants } from './src/db/schema.js';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

const botanicalVerification = fs.readFileSync('BOTANICAL_VERIFICATION.md', 'utf8');
const reviewDataPath = 'data/review-results.json';
const reviewData = JSON.parse(fs.readFileSync(reviewDataPath, 'utf8'));
const fullQaData = fs.existsSync('full_qa.md') ? fs.readFileSync('full_qa.md', 'utf8') : '';

// Map to translate confidence
const confMap = {
  high: 'Потвърдено (Ботанически архив)',
  medium: 'Вероятно (Ботанически архив)',
  low: 'Неопределимо (Ботанически архив)'
};

async function processPlants() {
  console.log('Starting 1-by-1 verification of plants...');
  
  const items = reviewData.items;
  let updatedCount = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imagePath = path.join('images/review', item.file);
    
    if (!fs.existsSync(imagePath)) {
      console.warn(`[Skip] Image not found: ${imagePath}`);
      continue;
    }
    
    console.log(`[${i+1}/${items.length}] Verifying ${item.file}...`);
    
    try {
      const mimeType = item.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64Image = fs.readFileSync(imagePath).toString('base64');
      
      const prompt = `You are an expert botanist and mycologist.
Review this image and its current data.

CURRENT DATA:
${JSON.stringify(item, null, 2)}

ADDITIONAL INSTRUCTIONS (from QA / Verification):
${botanicalVerification}
${fullQaData}

INSTRUCTIONS:
1. Verify the identification. If it's incorrect (like IMG_5512.jpg being Teucrium instead of Cistus), fix it.
2. If it is a fungus (like IMG_3284.jpg or IMG_5211.jpg), set family to "Fungi", add strong warnings about toxicity/non-edibility.
3. If the verification notes say to identify only to genus (e.g. Ranunculus sp., Quercus sp.), strictly do so.
4. Add clear safety notes or toxicity warnings if the plant/fungus is toxic (e.g. Helleborus, Digitalis).
5. Output ONLY valid JSON, with these exact keys:
{
  "likely_scientific_name": "Latin name (or sp. if genus only)",
  "likely_common_name_bg": "Bulgarian name",
  "family": "Botanical family (or Fungi)",
  "confidence": "high, medium, or low",
  "identification_level": "species, genus, or family",
  "visible_features": "Description in Bulgarian",
  "possible_lookalikes": "Similar plants in Bulgarian",
  "safety_note": "Toxicity or warnings in Bulgarian (if any)",
  "benefits": "Ecological or botanical significance",
  "habitat": "Typical habitat"
}
Output ONLY the JSON object, no markdown blocks, no other text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          { role: 'user', parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType } }
          ]}
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });
      
      let resText = response.text || '';
      resText = resText.replace(/^\`\`\`json/i, '').replace(/\`\`\`$/, '').trim();
      const verifiedData = JSON.parse(resText);
      
      // Update the JSON item
      items[i] = {
        file: item.file,
        ...verifiedData
      };
      
      // Update in DB if exists
      const existingRows = await db.select().from(plants);
      const rowToUpdate = existingRows.find(r => {
        try {
          const photos = JSON.parse(r.photos);
          return photos.includes(item.file);
        } catch(e) { return false; }
      });
      
      if (rowToUpdate) {
        await db.update(plants).set({
          commonName: verifiedData.likely_common_name_bg,
          latinName: verifiedData.likely_scientific_name,
          family: verifiedData.family,
          confidence: confMap[verifiedData.confidence] || verifiedData.confidence,
          recognition: verifiedData.visible_features,
          habitat: verifiedData.habitat,
          lookalikes: verifiedData.possible_lookalikes,
          benefits: verifiedData.benefits,
          risks: verifiedData.safety_note || 'Няма специфични рискове',
        }).where(eq(plants.id, rowToUpdate.id));
      }
      
      // Save progress
      fs.writeFileSync(reviewDataPath, JSON.stringify({ items }, null, 2));
      updatedCount++;
      
      // Add a small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      console.error(`Error processing ${item.file}:`, err.message);
      // Wait a bit longer if quota hit
      if (err.message.includes('429')) {
        console.log('Rate limit hit. Waiting 10s...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        i--; // Retry the same item
      }
    }
  }
  
  console.log(`Verification complete! Updated ${updatedCount} items.`);
}

processPlants().catch(console.error);
