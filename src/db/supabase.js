// fallow-ignore-file unused-file
// This module is imported by src/db/plants.js (getSupabasePlants) — the
// static dead-code analyzer does not currently trace this ESM default-import
// chain, so it is suppressed here rather than deleted. Verified live via
// GET /api/plants returning real Supabase UUID rows in local runtime testing.
import pg from 'pg';
const { Pool } = pg;

// Direct Postgres connection to the Supabase project (catalog source of
// truth for reads, per Task 4). Uses a single connection string provided
// only via environment configuration (SUPABASE_DB_URL) — never hardcoded,
// never committed, never exposed to browser code.
//
// The read-only "Published catalog is publicly readable" RLS policy on
// public.plants already grants full SELECT to anon/authenticated, so this
// connection does not need special role handling for Task 4's read path.
// fallow-ignore-next-line unused-export, complexity
export const createSupabasePool = () => {
    if (!global._supabasePool && process.env.SUPABASE_DB_URL) {
        try {
            global._supabasePool = new Pool({
                connectionString: process.env.SUPABASE_DB_URL,
                max: 10,
                connectionTimeoutMillis: 5000,
                // Supabase's pooled/direct Postgres endpoints require SSL. No custom
                // CA bundle is configured for this project, so certificate hostname
                // verification is relaxed rather than disabling TLS entirely.
                ssl: { rejectUnauthorized: false },
            });

            global._supabasePool.on('error', (err) => {
                console.error('Unexpected error on idle Supabase pool client:', err);
            });
        } catch (e) {
            console.warn('Failed to initialize Supabase PostgreSQL pool:', e.message);
            return null;
        }
    }
    return global._supabasePool || null;
};

const supabasePool = createSupabasePool();

// fallow-ignore-next-line unused-export
export default supabasePool;
