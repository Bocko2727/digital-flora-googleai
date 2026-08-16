import { db } from './index.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid, email, displayName, photoUrl) {
  if (!db || !process.env.SQL_HOST) {
    return { uid, email, displayName, photoUrl };
  }
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
          photoUrl: photoUrl || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error.message);
    return { uid, email, displayName, photoUrl };
  }
}

export async function getUsers() {
  if (!db || !process.env.SQL_HOST) {
    return [];
  }
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("Database getUsers failed:", error.message);
    return [];
  }
}
