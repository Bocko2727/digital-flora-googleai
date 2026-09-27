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
// A static import, so Vercel's dependency tracer always bundles pg (as in the
// working PR #36 deployment). The earlier "pg is missing" crashes on Vercel
// came from a skipped install step (fixed by vercel.json), not from pg.
import pg from 'pg';
import { getSupabaseDbUrl } from '../config/supabase-env.js';

// TLS parameters in the connection string override the ssl option passed to
// pg: with pg 8, the sslmode=require that the Supabase-Vercel integration puts
// in POSTGRES_URL becomes verify-full against the system CAs, which rejects
// Supabase's own CA and ignores SUPABASE_DB_CA_CERT. They are dropped from the
// string, and sslOptionsFor() turns the requested mode into the ssl option.
const CONNECTION_STRING_TLS_PARAMS = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

// fallow-ignore-next-line unused-export
export function withoutTlsParams(connectionString) {
    let url;
    try { url = new URL(connectionString); } catch { return connectionString; }
    if (!CONNECTION_STRING_TLS_PARAMS.some((param) => url.searchParams.has(param))) return connectionString;
    CONNECTION_STRING_TLS_PARAMS.forEach((param) => url.searchParams.delete(param));
    return url.toString();
}

// An explicit sslmode=verify-full/verify-ca keeps certificate verification,
// against the system CAs when SUPABASE_DB_CA_CERT is unset, so dropping the
// parameter never weakens it. Other modes (the integration's "require")
// follow libpq semantics: always encrypted, verified once a CA is configured.
// fallow-ignore-next-line unused-export
export function sslOptionsFor(connectionString, caCert) {
    const ssl = resolveSslConfig(caCert);
    let mode = null;
    try { mode = new URL(connectionString).searchParams.get('sslmode'); } catch { /* not a URL: defaults apply */ }
    return mode === 'verify-full' || mode === 'verify-ca' ? { ...ssl, rejectUnauthorized: true } : ssl;
}

// db.<ref>.supabase.co (direct connection and the dedicated pooler) resolves
// only over IPv6 unless the project has the IPv4 add-on; Vercel functions
// cannot reach it and fail with getaddrinfo ENOTFOUND. The shared Supavisor
// pooler (aws-*.pooler.supabase.com) is reachable over IPv4.
const DIRECT_DATABASE_HOST_RE = /^db\.[a-z0-9]+\.supabase\.co$/i;

// fallow-ignore-next-line unused-export
export function directHostWarning(connectionString, onVercel) {
    if (!onVercel) return null;
    let host;
    try { host = new URL(connectionString).hostname; } catch { return null; }
    if (!DIRECT_DATABASE_HOST_RE.test(host)) return null;
    return `The Supabase database URL points at ${host}, which is IPv6-only and unreachable from Vercel. Use the Transaction pooler URI (aws-*.pooler.supabase.com:6543) from Supabase > Connect. Until then the Data API is used.`;
}

// Keep one small pool per serverless instance. The connection string is resolved
// from the injected project environment and is never exposed to browser code.
// Returning null when it is absent preserves the public REST read fallback.
// fallow-ignore-next-line unused-export, complexity
export const createSupabasePool = () => {
    const connectionString = getSupabaseDbUrl();
    if (!connectionString) return null;
    const warning = directHostWarning(connectionString, Boolean(process.env.VERCEL));
    if (warning) console.warn(warning);

    const pool = new pg.Pool({
        connectionString: withoutTlsParams(connectionString),
        ssl: sslOptionsFor(connectionString, process.env.SUPABASE_DB_CA_CERT),
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
    });
    // An idle client can fail (e.g. the pooler closes it); without a listener
    // that 'error' event would crash the process.
    pool.on('error', (error) => { console.error('Supabase Postgres idle client error:', error.message); });
    return pool;
};

const supabasePool = createSupabasePool();

// Errors raised while a connection is being established, before any SQL is
// sent. Only these let a write be retried through the Data API: the statement
// cannot have run. Network errors count only for connect/DNS syscalls; the
// same codes on an open socket (read/write) may follow a sent statement.
const PRE_CONNECT_NETWORK_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH']);
const CONNECT_PHASE_CODES = new Set([
    '28P01', '28000', '3D000', // wrong password, rejected role, unknown database
    'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID',
]);
const CONNECT_PHASE_MESSAGE = /timeout exceeded when trying to connect|Connection terminated due to connection timeout|Tenant or user not found|does not support SSL connections/i;

function isPreConnectNetworkError(error) {
    return PRE_CONNECT_NETWORK_CODES.has(error?.code) && (error.syscall === 'connect' || error.syscall === 'getaddrinfo');
}

// fallow-ignore-next-line unused-export
export function isConnectionError(error) {
    if (!error) return false;
    if (isPreConnectNetworkError(error) || CONNECT_PHASE_CODES.has(error.code)) return true;
    // Dual-stack connects report every failed address in an AggregateError.
    if (Array.isArray(error.errors) && error.errors.length > 0 && error.errors.every(isPreConnectNetworkError)) return true;
    return CONNECT_PHASE_MESSAGE.test(String(error.message || ''));
}

// After a connection failure the pool is skipped for a while, so every
// request does not wait for the same failing connect (up to 5 s each).
const POOL_COOLDOWN_MS = 5 * 60 * 1000;
let poolUnavailableUntil = 0;

// The pool for this operation, or null when the Data API should be used:
// no database URL is configured, or the pool failed to connect recently.
export function getUsablePool() {
    if (!supabasePool || Date.now() < poolUnavailableUntil) return null;
    return supabasePool;
}

// Records a failed pool query. Returns true for a connection failure, which
// also pauses the pool for POOL_COOLDOWN_MS.
export function reportPoolFailure(error) {
    if (!isConnectionError(error)) return false;
    if (Date.now() >= poolUnavailableUntil) {
        console.error(`Supabase Postgres connection failed; using the Data API for the next ${POOL_COOLDOWN_MS / 60000} min:`, error.message);
    }
    poolUnavailableUntil = Date.now() + POOL_COOLDOWN_MS;
    return true;
}

// A read (SELECT) is safe to repeat, so any Postgres failure falls back to
// the Data API.
export async function readWithFallback(viaPostgres, viaDataApi) {
    const pool = getUsablePool();
    if (pool) {
        try {
            return await viaPostgres(pool);
        } catch (error) {
            if (!reportPoolFailure(error)) console.error('Supabase Postgres read failed; retrying through the Data API:', error.message);
        }
    }
    return viaDataApi();
}

// A write falls back only when the connection itself failed, so a statement
// that may have reached the database is never sent twice.
export async function writeWithFallback(viaPostgres, viaDataApi) {
    const pool = getUsablePool();
    if (pool) {
        try {
            return await viaPostgres(pool);
        } catch (error) {
            if (!reportPoolFailure(error)) throw error;
        }
    }
    return viaDataApi();
}

// fallow-ignore-next-line unused-export
export default supabasePool;
