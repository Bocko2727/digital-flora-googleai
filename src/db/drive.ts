import { db } from './index.ts';
import { driveImports } from './schema.ts';
import { desc } from 'drizzle-orm';

export async function logDriveImport(fileId: string, fileName: string, mimeType?: string, userUid?: string) {
  try {
    const res = await db.insert(driveImports).values({
      fileId,
      fileName,
      mimeType: mimeType || null,
      userUid: userUid || null,
    }).returning();
    return res[0];
  } catch (error) {
    console.error("Failed to log drive import:", error);
    // Non-fatal
    return null;
  }
}

export async function getDriveImports() {
  try {
    return await db.select().from(driveImports).orderBy(desc(driveImports.createdAt));
  } catch (error) {
    console.error("Failed to get drive imports:", error);
    return [];
  }
}
