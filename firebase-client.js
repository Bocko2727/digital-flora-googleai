// Legacy Firebase client removed.
// This module now only provides in-memory access token helpers for Google Drive,
// and is reserved for future Supabase client integration.

let cachedAccessToken = null;

export const setCachedAccessToken = (token) => {
  cachedAccessToken = token;
};

export const getCachedAccessToken = () => cachedAccessToken;
