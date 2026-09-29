
import { readWithFallback } from '../db/supabase.js';
import { supabaseRest } from '../db/supabase-rest.js';
import { getSupabasePublishableKey, getSupabaseUrl } from '../config/supabase-env.js';

const WRITABLE_ROLES = new Set(['editor', 'admin']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTH_TIMEOUT_MS = 8000;

function getAuthConfig() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
    if (!url || !publishableKey) return null;
    return { url: url.replace(/\/$/, ''), publishableKey };
}

function authorizationToken(req) {
    const header = req.get('authorization') || '';
    if (!/^Bearer /i.test(header)) return null;
    return header.slice(7).trim() || null;
}
function serverConfigurationError(code) {
    const error = new Error('Supabase authorization server configuration is unavailable.');
    error.code = code;
    return error;
}

// Supabase Auth or the profile lookup could not be reached: a 503 the UI can
// explain, instead of an unhandled 500 (or a misleading 401).
function authorizationUnavailable(cause) {
    const error = new Error(`Catalog authorization is temporarily unavailable: ${cause.message}`);
    error.code = 'CATALOG_AUTH_UNAVAILABLE';
    return error;
}

function normalizeRole(value) {
    return value === 'editor' || value === 'admin' ? value : 'viewer';
}

function verifiedUserId(user) {
    return typeof user?.id === 'string' ? user.id : null;
}

export function canPerformCatalogWrite(role, method) {
    return method === 'DELETE' ? role === 'admin' : WRITABLE_ROLES.has(role);
}

async function fetchVerifiedSupabaseUser(accessToken) {
    const config = getAuthConfig();
    if (!config) throw serverConfigurationError('SUPABASE_AUTH_NOT_CONFIGURED');
    let response;
    try {
        response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
    } catch (error) {
        throw authorizationUnavailable(error);
    }
    // A 4xx means the token is invalid or expired; a 5xx or 429 means Auth
    // itself is unavailable, which must not be reported as a bad token.
    if (response.status >= 500 || response.status === 429) throw authorizationUnavailable(new Error(`Supabase Auth returned HTTP ${response.status}`));
    if (!response.ok) return null;
    const user = await response.json();
    return verifiedUserId(user) ? user : null;
}

// The Postgres pool is tried first; if it is missing or failing, the same
// one-row lookup goes through the Data API (with the caller's own session
// when no server key is configured).
async function getProfileRole(userId, accessToken) {
    try {
        const role = await readWithFallback(
            async (pool) => (await pool.query('select role from public.profiles where id = $1 limit 1', [userId])).rows[0]?.role,
            async () => {
                if (!UUID_RE.test(userId)) return null;
                const rows = await supabaseRest(`profiles?id=eq.${userId}&select=role&limit=1`, { accessToken });
                return rows?.[0]?.role;
            },
        );
        return normalizeRole(role);
    } catch (error) {
        throw authorizationUnavailable(error);
    }
}

function authorizationFailure(res, error) {
    if (error.code === 'SUPABASE_AUTH_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Catalog authorization is not configured.', code: error.code });
    }
    if (error.code === 'CATALOG_AUTH_UNAVAILABLE') {
        console.error(error.message);
        return res.status(503).json({ error: 'Catalog authorization is temporarily unavailable.', code: 'CATALOG_AUTH_UNAVAILABLE' });
    }
    return null;
}

// fallow-ignore-next-line complexity
export async function authenticateCatalogActor(req, res, next) {
    try {
        const token = authorizationToken(req);
        if (!token) return res.status(401).json({ error: 'Authentication is required.', code: 'UNAUTHENTICATED' });
        const user = await fetchVerifiedSupabaseUser(token);
        if (!user) return res.status(401).json({ error: 'Invalid or expired access token.', code: 'UNAUTHENTICATED' });
        // accessToken lets the Data API fallback act as this user; it is never
        // sent back to the client (see /api/auth/whoami).
        req.catalogActor = { id: user.id, email: typeof user.email === 'string' ? user.email : null, role: await getProfileRole(user.id, token), accessToken: token };
        return next();
    } catch (error) {
        const response = authorizationFailure(res, error);
        return response || next(error);
    }
}

export function requireCatalogWritePermission(req, res, next) {
    if (!canPerformCatalogWrite(req.catalogActor?.role, req.method)) {
        return res.status(403).json({ error: 'Your catalog role does not permit this operation.', code: 'CATALOG_WRITE_FORBIDDEN' });
    }
    return next();
}
