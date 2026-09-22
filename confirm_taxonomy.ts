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
    gbif_taxonomy: z
      .record(z.unknown())
      .describe("The GBIF Backbone Taxonomy lookup result to store (raw object, as returned by the GBIF API)"),
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerConfirmTaxonomy(server: McpServer): void {
  server.registerTool(
    "flora_confirm_taxonomy",
    {
      title: "Confirm a Digital Flora plant's taxonomy",
      description: `Record an editor-confirmed GBIF taxonomy lookup for a plant and mark it
taxonomy_status="editor-confirmed".

This is the ONLY tool that should ever set taxonomy_status to "editor-confirmed" or write
gbif_taxonomy - per the app's data model, a GBIF result must never be auto-published as
verified fact without a human confirming it first. Look the species up against GBIF yourself
(or ask the user to) before calling this tool; this tool does not query GBIF itself.

Args:
  - id (string, uuid, required): the plant whose taxonomy is being confirmed
  - gbif_taxonomy (object, required): the raw GBIF Backbone Taxonomy match to store
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  The updated plant record with taxonomy_status="editor-confirmed" and gbif_taxonomy set.

Examples:
  - "I looked up Origanum vulgare on GBIF and it matches, confirm it for plant <uuid>"
    -> id="<uuid>", gbif_taxonomy={...GBIF match...}

Error Handling:
  - Returns "Error: Plant <id> not found." if the id doesn't exist.`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: Input) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(PLANTS_TABLE)
        .update({
          gbif_taxonomy: params.gbif_taxonomy,
          taxonomy_status: "editor-confirmed",
        })
        .eq("id", params.id)
        .select(PLANT_COLUMNS)
        .maybeSingle();

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }
      if (!data) {
        return { isError: true, content: [{ type: "text", text: `Error: Plant ${params.id} not found.` }] };
      }

      const plant = data as unknown as FloraPlant;
      return respond(
        params.response_format,
        `Taxonomy confirmed.\n\n${plantToMarkdown(plant)}`,
        params.response_format === ResponseFormat.JSON ? plant : plant
      );
    }
  );
}
