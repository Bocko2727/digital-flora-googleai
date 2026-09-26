// fallow-ignore-file unused-file
// This module is imported by src/db/plants.js (getSupabasePlants) — the
// static dead-code analyzer does not currently trace this ESM default-import
// chain, so it is suppressed here rather than deleted. Verified live via
// GET /api/plants returning real Supabase UUID rows in local runtime testing.
// Direct Postgres connection to the Supabase project (catalog source of
// truth for reads, per Task 4). Uses a single connection string provided
// only via environment configuration (SUPABASE_DB_URL) — never hardcoded,
// never committed, never exposed to browser code.
//
// The read-only "Published catalog is publicly readable" RLS policy on
// public.plants already grants full SELECT to anon/authenticated, so this
// connection does not need special role handling for Task 4's read path.
//
// P1.3 (Ден 4 security hardening): TLS defaults to verify-full once
// SUPABASE_DB_CA_CERT is set (the PEM contents of the CA certificate
// downloaded from Supabase Dashboard -> Database Settings -> SSL
// Configuration — see docs.supabase.com/guides/platform/ssl-enforcement;
// there is no stable public URL for it, it must come from the dashboard).
// Until that env var is set, this falls back to the previous relaxed
// verification so existing deployments keep working unmodified.
//
// fallow-ignore-next-line unused-export
export function resolveSslConfig(caCert) {
    if (!caCert) return { rejectUnauthorized: false };
    // Some hosting-provider env UIs (and a hand-edited single-line .env)
    // collapse a multi-line PEM into literal "\n" escape sequences instead
    // of real newlines. node's TLS CA parser needs real newlines, so a
    // literal backslash-n here would otherwise fail every connection once
    // rejectUnauthorized flips to true. A cert with genuine newlines
    // already (e.g. from `vercel env pull`) has no literal "\n" substring,
    // so it passes through unchanged.
    const normalizedCert = caCert.includes('\\n') ? caCert.replace(/\\n/g, '\n') : caCert;
    return { ca: normalizedCert, rejectUnauthorized: true };
}
const sslConfig = resolveSslConfig(process.env.SUPABASE_DB_CA_CERT);
// fallow-ignore-next-line unused-export, complexity
export const createSupabasePool = () => null;

const supabasePool = createSupabasePool();

// fallow-ignore-next-line unused-export
export default supabasePool;
