import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import * as schema from './schema.js';

export const createPool = () => {
  if (!global._postgresPool && process.env.SQL_HOST) {
    try {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 5000,
      });

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch (e) {
      console.warn('Failed to initialize PostgreSQL pool:', e.message);
      return null;
    }
  }
  return global._postgresPool || null;
};

const pool = createPool();

export const db = pool ? drizzle(pool, { schema }) : null;
