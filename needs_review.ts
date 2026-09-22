import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, PLANT_COLUMNS, describeSupabaseError } from "../services/supabase.js";
import { buildListResult, plantsToMarkdown, respond, truncateIfNeeded } from "../services/format.js";
import { paginationFields, responseFormatField } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import type { FloraPlant } from "../types.js";

const InputSchema = z
  .object({
    ...paginationFields,
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

// Records worth an editor's attention: anything not yet editor-confirmed.
const REVIEW_STATUSES = ["manual-unverified", "source-suggested", "needs-review"] as const;

export function registerNeedsReview(server: McpServer): void {
  server.registerTool(
    "flora_list_plants_needing_review",
    {
      title: "List Digital Flora plants needing taxonomy review",
      description: `List plant records whose taxonomy has NOT been editor-confirmed yet
(taxonomy_status is one of: ${REVIEW_STATUSES.join(", ")}).

Use this as the entry point for a taxonomy review pass - it is the "todo list" for
flora_confirm_taxonomy. Sorted oldest-updated first, so long-stale records surface first.

Args:
  - limit (number): max records to return, 1-100 (default 25)
  - offset (number): records to skip for pagination (default 0)
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  Same list schema as flora_list_plants (total, count, offset, items[], has_more, next_offset).

Examples:
  - "What still needs taxonomy review?" -> call with no arguments

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
      const { data, error, count } = await supabase
        .from(PLANTS_TABLE)
        .select(PLANT_COLUMNS, { count: "exact" })
        .in("taxonomy_status", REVIEW_STATUSES as unknown as string[])
        .order("updated_at", { ascending: true })
        .range(params.offset, params.offset + params.limit - 1);

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }

      const plants = (data ?? []) as unknown as FloraPlant[];
      const listResult = buildListResult(plants, count ?? plants.length, params.offset);
      const { data: possiblyTruncated } = truncateIfNeeded({ ...listResult, items: plants });
      const markdown = plantsToMarkdown(
        "Digital Flora — Needs Taxonomy Review",
        plants,
        count ?? plants.length
      );

      return respond(
        params.response_format,
        markdown,
        params.response_format === ResponseFormat.JSON ? possiblyTruncated : listResult
      );
    }
  );
}
