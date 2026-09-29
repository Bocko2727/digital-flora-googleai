import { getSupabasePublishableKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../config/supabase-env.js';

// Server-side Supabase Data API (PostgREST) client for the role lookup and
// catalog writes, used when the direct Postgres pool is missing or cannot
// connect (on Vercel the direct db.<ref>.supabase.co host is IPv6-only and
// fails with ENOTFOUND). Server-only: never import this into browser code.

const REST_TIMEOUT_MS = 8000;

// sb_publishable_/sb_secret_ keys are opaque, not JWTs: they go only in the
// apikey header and the gateway derives the role from them. Legacy
// anon/service_role keys are JWTs and are sent as the bearer token too.
export function apiKeyHeaders(key) {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` };
}

// The service-role (secret) key gives the same access as the Postgres pool;
// the server has already checked the caller's catalog role at that point.
// Without it the caller's own session is sent, so RLS applies the
// editor/admin policies on public.plants as well.
function requestCredentials(accessToken) {
  const serverKey = getSupabaseServiceRoleKey();
  if (serverKey) return apiKeyHeaders(serverKey);
  const publishableKey = getSupabasePublishableKey();
  if (publishableKey && accessToken) return { apikey: publishableKey, authorization: `Bearer ${accessToken}` };
  return null;
}

function restError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  return error;
}

// 4xx input rejections (check constraint, bad value, conflict) and access
// denials (RLS) are the caller's; everything else means the catalog is
// unavailable (network, timeout, missing configuration, 5xx).
function failureCode(status) {
  if (status === 400 || status === 409 || status === 422) return 'CATALOG_INVALID_INPUT';
  if (status === 401 || status === 403) return 'CATALOG_ACCESS_DENIED';
  return 'CATALOG_DATABASE_UNAVAILABLE';
}

// Sends one Data API request, e.g. supabaseRest('plants?id=eq.<uuid>&select=id').
// Callers put only validated values (UUIDs, fixed column names) into the path.
export async function supabaseRest(pathAndQuery, { method = 'GET', body, accessToken, prefer } = {}) {
  const url = getSupabaseUrl();
  const credentials = requestCredentials(accessToken);
  if (!url || !credentials) {
    throw restError('Supabase Data API is not configured on the server.', 'CATALOG_DATABASE_UNAVAILABLE');
  }
  const headers = { ...credentials, accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (prefer) headers.prefer = prefer;
  const table = pathAndQuery.split('?')[0];

  let response;
  try {
    response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${pathAndQuery}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
  } catch (error) {
    throw restError(`Supabase Data API ${method} ${table} failed: ${error.message}`, 'CATALOG_DATABASE_UNAVAILABLE');
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const reason = detail && detail.code ? ` (${detail.code})` : '';
    throw restError(`Supabase Data API ${method} ${table} failed with HTTP ${response.status}${reason}.`, failureCode(response.status), response.status);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
