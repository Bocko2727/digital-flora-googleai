import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, describeSupabaseError } from "../services/supabase.js";
import { responseFormatField } from "../schemas/common.js";
import { respond } from "../services/format.js";
import { ResponseFormat } from "../types.js";

const InputSchema = z
  .object({
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

interface CatalogStats {
  total_plants: number;
  by_taxonomy_status: Record<string, number>;
  by_confidence: Record<string, number>;
  plants_without_photos: number;
}

export function registerCatalogStats(server: McpServer): void {
  server.registerTool(
    "flora_get_catalog_stats",
    {
      title: "Get Digital Flora catalog statistics",
      description: `Get summary counts across the whole Digital Flora catalog: total records,
breakdown by taxonomy_status, breakdown by confidence label, and how many records have zero photos.

Useful as a quick health check before a QA pass or a deploy, and to answer "how big is my
catalog" / "how much is left to review" style questions without listing every record.

Args:
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  JSON format schema:
  {
    "total_plants": number,
    "by_taxonomy_status": { "<status>": number, ... },
    "by_confidence": { "<label>": number, ... },
    "plants_without_photos": number
  }

Examples:
  - "How many plants still need review, and how many have no photos?" -> call with no arguments

Error Handling:
  - Returns "Error: ..." with the Supabase/Postgres error message if the query fails.`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: Input) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(PLANTS_TABLE)
        .select("taxonomy_status, confidence, photos");

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }

      const rows = (data ?? []) as { taxonomy_status: string; confidence: string; photos: unknown[] }[];

      const stats: CatalogStats = {
        total_plants: rows.length,
        by_taxonomy_status: {},
        by_confidence: {},
        plants_without_photos: 0,
      };

      for (const row of rows) {
        stats.by_taxonomy_status[row.taxonomy_status] =
          (stats.by_taxonomy_status[row.taxonomy_status] ?? 0) + 1;
        stats.by_confidence[row.confidence] = (stats.by_confidence[row.confidence] ?? 0) + 1;
        if (!row.photos || row.photos.length === 0) stats.plants_without_photos += 1;
      }

      const lines = [
        "# Digital Flora — Catalog Stats",
        "",
        `- **Total plants**: ${stats.total_plants}`,
        `- **Without photos**: ${stats.plants_without_photos}`,
        "",
        "## By taxonomy status",
        ...Object.entries(stats.by_taxonomy_status).map(([k, v]) => `- ${k}: ${v}`),
        "",
        "## By confidence",
        ...Object.entries(stats.by_confidence).map(([k, v]) => `- ${k}: ${v}`),
      ];

      return respond(
        params.response_format,
        lines.join("\n"),
        params.response_format === ResponseFormat.JSON ? stats : stats
      );
    }
  );
}
