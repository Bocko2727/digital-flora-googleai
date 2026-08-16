import fs from 'fs';
import path from 'path';
import { eq, ilike } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { plants } from './src/db/schema.js';

const reviewDataPath = 'data/review-results.json';
const reviewData = JSON.parse(fs.readFileSync(reviewDataPath, 'utf8'));

const fixes = {
  'IMG_1759.jpg': { latinName: 'Ranunculus sp.', commonName: 'Лютиче', confidence: 'medium' },
  'IMG_1766.jpg': { latinName: 'Neotinea ustulata', confidence: 'medium' },
  'IMG_2372.jpg': { latinName: 'Leontopodium nivale subsp. alpinum', confidence: 'medium' },
  'IMG_2373.jpg': { latinName: 'Leontopodium nivale subsp. alpinum', confidence: 'medium' },
  'IMG_3284.jpg': { latinName: 'Agaricales (неопределена гъба)', commonName: 'Пластинеста гъба', family: 'Fungi', confidence: 'low', risks: 'СИЛНО ОТРОВНО: Това е гъба, а не растение. Не се препоръчва събиране и консумация под никаква форма!' },
  'IMG_4387.jpg': { latinName: 'Crocus sp.', commonName: 'Минзухар', confidence: 'medium' },
  'IMG_4460.jpg': { latinName: 'Crocus sp.', commonName: 'Минзухар', confidence: 'medium', risks: 'Внимание: често се бърка с отровния есенен минзухар (Colchicum).' },
  'IMG_4479.jpg': { latinName: 'Helleborus odorus', commonName: 'Миризлива чемерика', confidence: 'medium', risks: 'СИЛНО ОТРОВНО: Съдържа опасни токсини (сърдечни гликозиди). Не се докосвайте и не поглъщайте!' },
  'IMG_4754.jpg': { latinName: 'Pulmonaria sp.', commonName: 'Медуница', confidence: 'medium' },
  'IMG_5211.jpg': { latinName: 'Russula sp.', commonName: 'Червена гълъбка', family: 'Fungi', confidence: 'low', risks: 'ГЪБА: Поради риск от объркване с отровни видове (напр. Бясна гъба), не консумирайте!' },
  'IMG_5214.jpg': { latinName: 'Hemerocallis fulva', commonName: 'Оранжева лилейка', confidence: 'medium', risks: 'ВНИМАНИЕ: Силно токсично за котки!' },
  'IMG_5496.jpg': { latinName: 'Cirsium sp.', commonName: 'Бодил', confidence: 'medium' },
  'IMG_5503.jpg': { latinName: 'Vicia sp.', commonName: 'Фий', confidence: 'medium', risks: 'Не се препоръчва консумация на семената.' },
  'IMG_5504.jpg': { latinName: 'Digitalis grandiflora', commonName: 'Едроцветен напръстник', confidence: 'medium', risks: 'СИЛНО ОТРОВНО: Съдържа мощни сърдечни гликозиди. Опасно за живота при поглъщане!' },
  'IMG_5505.jpg': { latinName: 'Eupatorium cannabinum', commonName: 'Конопена водна конопка', confidence: 'medium', risks: 'Не се препоръчва за вътрешна употреба без консултация със специалист.' },
  'IMG_5506.jpg': { latinName: 'Viburnum sp.', commonName: 'Калина', confidence: 'medium', risks: 'Плодовете могат да бъдат леко токсични, не се препоръчва консумация.' },
  'IMG_5510.jpg': { latinName: 'Prunus sp.', commonName: 'Слива (вид)', confidence: 'medium', risks: 'Костилките съдържат цианогенни гликозиди.' },
  'IMG_5511.jpg': { latinName: 'Phillyrea sp.', commonName: 'Филирея (вероятно)', confidence: 'low' },
  'IMG_5513.jpg': { latinName: 'Quercus sp.', commonName: 'Дъб (вид)', confidence: 'low' },
  'IMG_5536.jpg': { latinName: 'Ruscus sp.', commonName: 'Бодлив залист', confidence: 'medium' },
  'IMG_5550.jpg': { latinName: 'Lonicera sp.', commonName: 'Орлови нокти', confidence: 'medium', risks: 'Плодовете на повечето видове са отровни!' },
  'IMG_5633.jpg': { latinName: 'Sempervivum sp.', commonName: 'Тлъстига (Дебелец)', confidence: 'medium' },
  'IMG_5736.jpg': { latinName: 'Pyracantha coccinea', commonName: 'Огнен трън', confidence: 'medium', risks: 'Растението има остри бодли; семената в плодовете могат да бъдат леко токсични.' },
  'IMG_5759.jpg': { latinName: 'Echium vulgare', commonName: 'Обикновена синя усойница', confidence: 'medium', risks: 'Съдържа пиролизидинови алкалоиди; продължителната вътрешна употреба уврежда черния дроб.' },
  'IMG_5512.jpg': { latinName: 'Teucrium polium', commonName: 'Бяло подъбиче / Горски здравец', family: 'Lamiaceae', confidence: 'medium', recognition: 'Растение от рода Teucrium, бъркано с памуклийка.' },
  'IMG_5763.jpg': { latinName: 'Linaria vulgaris', commonName: 'Обикновена луличка', confidence: 'medium' },
  'IMG_5791.jpg': { latinName: 'Verbascum thapsus', commonName: 'Обикновен лопен', confidence: 'high' }
};

const confMap = {
  high: 'Потвърдено (Ботанически архив)',
  medium: 'Вероятно (Ботанически архив)',
  low: 'Неопределимо (Ботанически архив)'
};

async function run() {
  console.log('Applying targeted manual fixes...');
  let updatedCount = 0;
  
  // 1. Update JSON
  for (const item of reviewData.items) {
    if (fixes[item.file]) {
      const fix = fixes[item.file];
      if (fix.latinName) item.likely_scientific_name = fix.latinName;
      if (fix.commonName) item.likely_common_name_bg = fix.commonName;
      if (fix.family) item.family = fix.family;
      if (fix.confidence) item.confidence = fix.confidence;
      if (fix.risks) item.safety_note = fix.risks;
      if (fix.recognition) item.visible_features = fix.recognition;
    }
  }
  
  fs.writeFileSync(reviewDataPath, JSON.stringify(reviewData, null, 2));
  console.log('JSON updated.');

  // 2. Update Database
  const existingRows = await db.select().from(plants);
  for (const row of existingRows) {
    let matchedFile = null;
    try {
      const photos = JSON.parse(row.photos);
      matchedFile = photos[0];
    } catch(e) {}
    
    if (matchedFile && fixes[matchedFile]) {
      const fix = fixes[matchedFile];
      
      const updateData = {};
      if (fix.latinName) updateData.latinName = fix.latinName;
      if (fix.commonName) updateData.commonName = fix.commonName;
      if (fix.family) updateData.family = fix.family;
      if (fix.confidence) updateData.confidence = confMap[fix.confidence];
      if (fix.risks) updateData.risks = fix.risks;
      if (fix.recognition) updateData.recognition = fix.recognition;
      
      await db.update(plants).set(updateData).where(eq(plants.id, row.id));
      updatedCount++;
    }
  }
  
  console.log(`Successfully applied fixes to ${updatedCount} DB records.`);
  process.exit(0);
}

run().catch(console.error);
