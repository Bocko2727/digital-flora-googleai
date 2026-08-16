import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const plants = pgTable('plants', {
  id: serial('id').primaryKey(),
  commonName: text('common_name').notNull(),
  latinName: text('latin_name').notNull(),
  family: text('family'),
  photos: text('photos').notNull(), // JSON string array of image URLs
  confidence: text('confidence').default('Вероятно'),
  recognition: text('recognition'),
  habitat: text('habitat'),
  lookalikes: text('lookalikes'),
  benefits: text('benefits'),
  risks: text('risks'),
  uses: text('uses'),
  funFact: text('fun_fact'),
  authorEmail: text('author_email'),
  authorUid: text('author_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const driveImports = pgTable('drive_imports', {
  id: serial('id').primaryKey(),
  fileId: text('file_id').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  userUid: text('user_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});
