// Removes every Supabase/Postgres setting the server code could pick up,
// including integration-prefixed names (src/config/supabase-env.js matches
// suffixes), so a test process can never reach a real project, e.g. in a
// Codespace whose secrets hold production values. Importing this module
// clears them; import it before loading any src/ module.
const SUFFIXES = [
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY', 'SUPABASE_DB_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING',
];

export function clearSupabaseEnv() {
  for (const key of Object.keys(process.env)) {
    if (SUFFIXES.some((suffix) => key === suffix || key.endsWith(`_${suffix}`))) delete process.env[key];
  }
}

// Replaces the Supabase settings with exactly `values` (fake test values only).
export function useSupabaseEnv(values) {
  clearSupabaseEnv();
  Object.assign(process.env, values);
}

clearSupabaseEnv();
