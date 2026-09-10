
import supabasePool from '../db/supabase.js';

const WRITABLE_ROLES = new Set(['editor', 'admin']);

function getAuthConfig() {
    const url = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publishableKey) return null;
    return { url: url.replace(/\/$/, ''), publishableKey };
}

function authorizationToken(req) {
    const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
    return match?.[1]?.trim() || null;
}

function serverConfigurationError(code) {
    const error = new Error('Supabase authorization server configuration is unavailable.');
    error.code = code;
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
    const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    const user = await response.json();
    return verifiedUserId(user) ? user : null;
}

async function getProfileRole(userId) {
    if (!supabasePool) throw serverConfigurationError('SUPABASE_DATABASE_NOT_CONFIGURED');
    const { rows } = await supabasePool.query('select role from public.profiles where id = $1 limit 1', [userId]);
    return normalizeRole(rows[0]?.role);
}

function authorizationFailure(res, error) {
    if (error.code === 'SUPABASE_AUTH_NOT_CONFIGURED' || error.code === 'SUPABASE_DATABASE_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Catalog authorization is not configured.', code: error.code });
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
        req.catalogActor = { id: user.id, email: typeof user.email === 'string' ? user.email : null, role: await getProfileRole(user.id) };
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