// One-off read-only diagnostic for P1.2 (Ден 4 security hardening).
//
// Answers a single question: does the Postgres role behind SUPABASE_DB_URL
// (the connection server.js uses for plant writes, via src/db/supabase.js)
// carry BYPASSRLS? If it does, the RLS policies on public.plants/profiles
// have zero effect on that write path regardless of what they say — only
// app-level authorization (src/auth/catalog-authorization.js) enforces
// anything, and a non-superuser app role would need to be provisioned
// before RLS is meaningful there.
//
// Reuses createSupabasePool() from src/db/supabase.js — the exact pool
// server.js's write path uses — instead of a hand-rolled one, so this
// script can never drift from the connection it claims to be diagnosing.
//
// Run wherever SUPABASE_DB_URL is actually set (e.g. `vercel env pull
// .env.local && node --env-file=.env.local scripts/check-write-role.js`,
// or paste the value into a throwaway local .env for this one run only).
// Prints only the role name and two booleans — never the connection
// string itself, never any table data.
import { createSupabasePool } from '../src/db/supabase.js';

if (!process.env.SUPABASE_DB_URL) {
    console.error('SUPABASE_DB_URL is not set in this environment. Nothing to check.');
    process.exit(1);
}

const pool = createSupabasePool();
if (!pool) {
    console.error('Failed to initialize the Supabase pool (see the warning logged above).');
    process.exit(1);
}

try {
    const { rows } = await pool.query(
        `select current_user as role_name,
                (select rolbypassrls from pg_roles where rolname = current_user) as bypasses_rls,
                (select rolsuper from pg_roles where rolname = current_user) as is_superuser;`
    );
    console.log(JSON.stringify(rows[0], null, 2));
    if (rows[0]?.bypasses_rls || rows[0]?.is_superuser) {
        console.log('\n=> This role bypasses RLS. Plant-table RLS policies do not constrain this write path.');
    } else {
        console.log('\n=> This role does NOT bypass RLS. RLS policies are actually enforced on this write path.');
    }
} catch (err) {
    console.error('Diagnostic query failed:', err.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
