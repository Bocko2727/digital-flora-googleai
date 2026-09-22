// Maximum response size in characters before we truncate and tell the agent to narrow its query.
export const CHARACTER_LIMIT = 25000;

// Default / max page sizes for list-style tools.
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Valid taxonomy_status values (mirrors the DB check constraint on public.plants).
export const TAXONOMY_STATUSES = [
  "manual-unverified",
  "source-suggested",
  "editor-confirmed",
  "needs-review",
] as const;

// Valid profiles.role values (mirrors the DB check constraint on public.profiles).
export const PROFILE_ROLES = ["viewer", "editor", "admin"] as const;
