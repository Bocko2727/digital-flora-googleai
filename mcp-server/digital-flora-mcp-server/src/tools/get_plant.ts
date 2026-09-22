import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, PLANT_COLUMNS, describeSupabaseError } from "../services/supabase.js";
import { plantIdField, responseFormatField } from "../schemas/common.js";
import { plantToMarkdown, respond } from "../services/format.js";
import { ResponseFormat } from "../types.js";
import type { FloraPlant } from "../types.js";

const InputSchema = z
  .object({
    id: plantIdField,
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerGetPlant(server: McpServer): void {
  server.registerTool(
    "flora_get_plant",
    {
      title: "Get one Digital Flora plant record",
      description: `Fetch a single plant record by id, including its full photo list and taxonomy metadata.

Args:
  - id (string, uuid): the plant's id, from flora_list_plants or flora_add_plant
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  JSON format: the full plant record (id, common_name, latin_name, family, photos[], confidence,
  recognition, habitat, lookalikes, benefits, risks, uses, fun_fact, author_email, source_record,
  gbif_taxonomy, taxonomy_status, created_at, updated_at).

Examples:
  - "Show me everything about plant <uuid>" -> id="<uuid>"

Error Handling:
  - Returns "Error: Plant <id> not found." if no record matches.`,
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
        .select(PLANT_COLUMNS)
        .eq("id", params.id)
        .maybeSingle();

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }
      if (!data) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: Plant ${params.id} not found.` }],
        };
      }

      const plant = data as unknown as FloraPlant;
      return respond(
        params.response_format,
        plantToMarkdown(plant),
        params.response_format === ResponseFormat.JSON ? plant : plant
      );
    }
  );
}
