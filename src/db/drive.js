import { db } from './index.js';
import { driveImports } from './schema.js';
import { desc } from 'drizzle-orm';

export async function logDriveImport(fileId, fileName, mimeType, userUid) {
  if (!db || !process.env.SQL_HOST) {
    return { fileId, fileName, mimeType, userUid };
  }
  try {
    const res = await db.insert(driveImports).values({
      fileId,
      fileName,
      mimeType: mimeType || null,
      userUid: userUid || null,
    }).returning();
    return res[0];
  } catch (error) {
    console.error("Failed to log drive import:", error.message);
    return null;
  }
}

export async function getDriveImports() {
  if (!db || !process.env.SQL_HOST) {
    return [];
  }
  try {
    return await db.select().from(driveImports).orderBy(desc(driveImports.createdAt));
  } catch (error) {
    console.error("Failed to get drive imports:", error.message);
    return [];
  }
}
