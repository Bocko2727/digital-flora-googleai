import { TAXONOMY_STATUSES } from "./constants.js";

export type TaxonomyStatus = (typeof TAXONOMY_STATUSES)[number];

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// A single photo entry stored inside plants.photos (jsonb array).
// The exact shape used by the app today is treated as free-form metadata
// plus a required url, since the column has no schema of its own beyond
// "must be a JSON array".
export interface FloraPhoto {
  url: string;
  caption?: string;
  taken_at?: string;
  [key: string]: unknown;
}

export interface FloraPlant {
  id: string;
  common_name: string;
  latin_name: string;
  family: string | null;
  photos: FloraPhoto[];
  confidence: string;
  recognition: string | null;
  habitat: string | null;
  lookalikes: string | null;
  benefits: string | null;
  risks: string | null;
  uses: string | null;
  fun_fact: string | null;
  author_email: string | null;
  source_record: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  source_file: string | null;
  gbif_taxonomy: Record<string, unknown> | null;
  taxonomy_status: TaxonomyStatus;
}

// Fields an agent is allowed to set directly. id/created_at/updated_at are
// server-managed; gbif_taxonomy + taxonomy_status="editor-confirmed" only
// happen together via flora_confirm_taxonomy, never a bare update.
export type FloraPlantWritableFields = Partial<
  Pick<
    FloraPlant,
    | "common_name"
    | "latin_name"
    | "family"
    | "confidence"
    | "recognition"
    | "habitat"
    | "lookalikes"
    | "benefits"
    | "risks"
    | "uses"
    | "fun_fact"
    | "author_email"
  >
>;
