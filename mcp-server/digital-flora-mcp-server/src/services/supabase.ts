import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FloraPlant } from "../types.js";

let client: SupabaseClient | null = null;

/**
 * Lazily-initialized singleton Supabase client, authenticated with the
 * service role key so the MCP server can bypass RLS for the single
 * authorized user of this personal catalog. Never expose this key to
 * the browser/client side of the actual app - it belongs only in this
 * server's environment.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Set them before starting the server (see README.md)."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const PLANTS_TABLE = "plants";

// Columns returned for full plant records. Kept as a constant so every
// tool that reads a full record stays in sync if the schema grows.
export const PLANT_COLUMNS =
  "id, common_name, latin_name, family, photos, confidence, recognition, " +
  "habitat, lookalikes, benefits, risks, uses, fun_fact, author_email, " +
  "source_record, created_at, updated_at, source_file, gbif_taxonomy, taxonomy_status";

/** Human-readable Postgres/PostgREST error -> actionable MCP error text. */
export function describeSupabaseError(error: {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}): string {
  const parts = [`Error: ${error.message}`];
  if (error.code) parts.push(`(code ${error.code})`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(" ");
}

export type PlantRow = FloraPlant;
