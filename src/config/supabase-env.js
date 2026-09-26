function findEnvironmentValue(name, matches = [name]) {
  if (process.env[name]) return process.env[name];

  const candidate = Object.keys(process.env)
    .filter((key) => matches.some((suffix) => key === suffix || key.endsWith(`_${suffix}`)))
    .sort((a, b) => a.length - b.length)
    .map((key) => process.env[key])
    .find(Boolean);

  return candidate || '';
}

export function getSupabaseUrl() {
  return findEnvironmentValue('SUPABASE_URL', ['SUPABASE_URL']);
}

export function getSupabasePublishableKey() {
  return findEnvironmentValue('SUPABASE_PUBLISHABLE_KEY', [
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
  ]);
}

export function getSupabaseServiceRoleKey() {
  return findEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_ROLE_KEY']);
}

export function getSupabaseDbUrl() {
  return findEnvironmentValue('SUPABASE_DB_URL', [
    'SUPABASE_DB_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL',
  ]);
}
