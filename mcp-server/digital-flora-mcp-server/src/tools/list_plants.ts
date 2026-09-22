import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, PLANT_COLUMNS, describeSupabaseError } from "../services/supabase.js";
import { buildListResult, plantsToMarkdown, respond, truncateIfNeeded } from "../services/format.js";
import { paginationFields, responseFormatField, taxonomyStatusField } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import type { FloraPlant } from "../types.js";

const InputSchema = z
  .object({
    search: z
      .string()
      .max(200)
      .optional()
      .describe("Case-insensitive substring match against common_name or latin_name"),
    family: z.string().max(200).optional().describe("Exact match on the plant family"),
    taxonomy_status: taxonomyStatusField
      .optional()
      .describe("Filter to a single taxonomy_status value"),
    ...paginationFields,
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerListPlants(server: McpServer): void {
  server.registerTool(
    "flora_list_plants",
    {
      title: "List Digital Flora plants",
      description: `List plant records from the Digital Flora catalog, with optional search and filters.

This tool ONLY reads data; it never creates or modifies records. Use flora_add_plant to create a new record.

Args:
  - search (string, optional): case-insensitive substring match against common_name or latin_name
  - family (string, optional): exact match on the family column
  - taxonomy_status (string, optional): one of manual-unverified | source-suggested | editor-confirmed | needs-review
  - limit (number): max records to return, 1-100 (default 25)
  - offset (number): records to skip for pagination (default 0)
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  JSON format schema:
  {
    "total": number,       // total matching records in the catalog
    "count": number,       // records in this page
    "offset": number,
    "items": [ { id, common_name, latin_name, family, confidence, taxonomy_status, photos: [...], ... } ],
    "has_more": boolean,
    "next_offset": number  // present only if has_more
  }

Examples:
  - "What plants do I have with unclear taxonomy?" -> taxonomy_status="needs-review"
  - "Find the record for oregano" -> search="oregano"

Error Handling:
  - Returns "Error: ..." with the Supabase/Postgres error message and hint if the query fails.`,
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
      let query = supabase
        .from(PLANTS_TABLE)
        .select(PLANT_COLUMNS, { count: "exact" })
        .order("common_name", { ascending: true })
        .range(params.offset, params.offset + params.limit - 1);

      if (params.search) {
        const term = params.search.replace(/[\\%_]/g, "\\$&");
        query = query.or(`common_name.ilike.%${term}%,latin_name.ilike.%${term}%`);
      }
      if (params.family) query = query.eq("family", params.family);
      if (params.taxonomy_status) query = query.eq("taxonomy_status", params.taxonomy_status);

      const { data, error, count } = await query;

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }

      const plants = (data ?? []) as unknown as FloraPlant[];
      const listResult = buildListResult(plants, count ?? plants.length, params.offset);
      const { text: jsonText, data: possiblyTruncated } = truncateIfNeeded({
        ...listResult,
        items: plants,
      });

      const markdown = plantsToMarkdown("Digital Flora — Plants", plants, count ?? plants.length);

      return respond(
        params.response_format,
        markdown,
        params.response_format === ResponseFormat.JSON ? possiblyTruncated : listResult
      );
    }
  );
}
