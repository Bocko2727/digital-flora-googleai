import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.ts';
import { plants } from './schema.ts';
import { desc, eq, count } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PlantInput {
  commonName: string;
  latinName: string;
  family?: string;
  photos: string[];
  confidence?: string;
  recognition?: string;
  habitat?: string;
  lookalikes?: string;
  benefits?: string;
  risks?: string;
  uses?: string;
  funFact?: string;
  authorEmail?: string;
  authorUid?: string;
}

export async function seedPlantsIfEmpty() {
  try {
    const jsonPath = path.resolve(__dirname, '../../data/review-results.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn('review-results.json not found at', jsonPath);
      return;
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const items = data.items || [];
    if (!items.length) return;

    const existingRows = await db.select({ photos: plants.photos }).from(plants);
    const existingPhotos = new Set<string>();
    existingRows.forEach(r => {
      try {
        const arr = JSON.parse(r.photos || '[]');
        arr.forEach((p: string) => existingPhotos.add(p));
      } catch (e) {}
    });

    const confMap: Record<string, string> = {
      high: 'Потвърдено (Ботанически архив)',
      medium: 'Вероятно (Ботанически архив)',
      low: 'Неопределимо (Ботанически архив)'
    };

    let inserted = 0;
    for (const item of items) {
      const photoFile = item.file || 'placeholder.jpg';
      if (!existingPhotos.has(photoFile)) {
        await db.insert(plants).values({
          commonName: item.likely_common_name_bg || 'Неопределено растение',
          latinName: item.likely_scientific_name || 'Неопределен таксон',
          family: item.family || 'Семейство',
          photos: JSON.stringify([photoFile]),
          confidence: confMap[item.confidence] || item.confidence || 'Вероятно',
          recognition: item.visible_features || 'Няма допълнителни данни',
          habitat: item.habitat || 'Ботанически образец от България',
          lookalikes: Array.isArray(item.possible_lookalikes) ? item.possible_lookalikes.join(', ') : (item.possible_lookalikes || '-'),
          benefits: item.benefits || 'Ботаническо и флористично значение за биоразнообразието.',
          risks: item.safety_note || 'Няма регистрирани критични рискове.',
          uses: item.uses || 'Хербариен образец и ботаническо наблюдение.',
          funFact: item.funFact || item.additional_photos_needed || 'Изисква се наблюдение в период на активен цъфтеж.',
          authorEmail: 'digitalflora@botany.bg',
          authorUid: 'system_botanist'
        });
        existingPhotos.add(photoFile);
        inserted++;
      }
    }

    if (inserted > 0) {
      console.log(`Successfully synced and seeded ${inserted} new plants into Cloud SQL!`);
    }
  } catch (err) {
    console.error('Error seeding plants into Cloud SQL:', err);
  }
}

export async function getSqlPlants() {
  try {
    const rows = await db.select().from(plants).orderBy(desc(plants.createdAt));
    return rows.map(r => ({
      id: String(r.id),
      commonName: r.commonName,
      latinName: r.latinName,
      family: r.family || '',
      photos: JSON.parse(r.photos || '[]'),
      confidence: r.confidence || 'Вероятно',
      recognition: r.recognition || 'Няма данни',
      habitat: r.habitat || '-',
      lookalikes: r.lookalikes || '-',
      benefits: r.benefits || '-',
      risks: r.risks || '-',
      uses: r.uses || '-',
      funFact: r.funFact || '-',
      authorEmail: r.authorEmail || '',
      authorUid: r.authorUid || '',
      createdAt: r.createdAt
    }));
  } catch (error) {
    console.error("Database getPlants failed:", error);
    throw new Error("Failed to fetch plants from database", { cause: error });
  }
}

export async function insertSqlPlant(input: PlantInput) {
  try {
    const res = await db.insert(plants).values({
      commonName: input.commonName,
      latinName: input.latinName,
      family: input.family || null,
      photos: JSON.stringify(input.photos || []),
      confidence: input.confidence || 'Вероятно',
      recognition: input.recognition || null,
      habitat: input.habitat || null,
      lookalikes: input.lookalikes || null,
      benefits: input.benefits || null,
      risks: input.risks || null,
      uses: input.uses || null,
      funFact: input.funFact || null,
      authorEmail: input.authorEmail || null,
      authorUid: input.authorUid || null,
    }).returning();
    const r = res[0];
    return {
      ...r,
      id: String(r.id),
      photos: JSON.parse(r.photos || '[]')
    };
  } catch (error) {
    console.error("Database insertPlant failed:", error);
    throw new Error("Failed to save plant in database", { cause: error });
  }
}

export async function updateSqlPlant(id: number | string, input: Partial<PlantInput>) {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const updateData: any = {};
    if (input.commonName !== undefined) updateData.commonName = input.commonName;
    if (input.latinName !== undefined) updateData.latinName = input.latinName;
    if (input.family !== undefined) updateData.family = input.family;
    if (input.photos !== undefined) updateData.photos = JSON.stringify(input.photos);
    if (input.confidence !== undefined) updateData.confidence = input.confidence;
    if (input.recognition !== undefined) updateData.recognition = input.recognition;
    if (input.habitat !== undefined) updateData.habitat = input.habitat;
    if (input.lookalikes !== undefined) updateData.lookalikes = input.lookalikes;
    if (input.benefits !== undefined) updateData.benefits = input.benefits;
    if (input.risks !== undefined) updateData.risks = input.risks;
    if (input.uses !== undefined) updateData.uses = input.uses;
    if (input.funFact !== undefined) updateData.funFact = input.funFact;

    const res = await db.update(plants).set(updateData).where(eq(plants.id, numericId)).returning();
    const r = res[0];
    return {
      ...r,
      id: String(r.id),
      photos: JSON.parse(r.photos || '[]')
    };
  } catch (error) {
    console.error("Database updatePlant failed:", error);
    throw new Error("Failed to update plant in database", { cause: error });
  }
}

export async function deleteSqlPlant(id: number | string) {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    await db.delete(plants).where(eq(plants.id, numericId));
    return { success: true };
  } catch (error) {
    console.error("Database deletePlant failed:", error);
    throw new Error("Failed to delete plant from database", { cause: error });
  }
}
