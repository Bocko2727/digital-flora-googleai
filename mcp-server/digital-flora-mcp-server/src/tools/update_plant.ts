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
    common_name: z.string().trim().min(1).max(200).optional(),
    latin_name: z.string().trim().min(1).max(200).optional(),
    family: z.string().trim().max(200).optional(),
    habitat: z.string().max(2000).optional(),
    recognition: z.string().max(2000).optional(),
    lookalikes: z.string().max(2000).optional(),
    benefits: z.string().max(2000).optional(),
    risks: z.string().max(2000).optional(),
    uses: z.string().max(2000).optional(),
    fun_fact: z.string().max(2000).optional(),
    confidence: z.string().max(50).optional(),
    author_email: z.string().email().optional(),
    response_format: responseFormatField,
  })
  .strict()
  .refine(
    (v) =>
      Object.keys(v).some(
        (k) => k !== "id" && k !== "response_format" && v[k as keyof typeof v] !== undefined
      ),
    { message: "Provide at least one field to update besides 'id'." }
  );

type Input = z.infer<typeof InputSchema>;

export function registerUpdatePlant(server: McpServer): void {
  server.registerTool(
    "flora_update_plant",
    {
      title: "Update a Digital Flora plant record",
      description: `Update one or more editable fields on an existing plant record.

This tool does NOT touch photos, taxonomy_status, or gbif_taxonomy - use flora_add_photo and
flora_confirm_taxonomy for those, since they follow their own workflows.

Args:
  - id (string, uuid, required): the plant to update
  - common_name, latin_name, family, habitat, recognition, lookalikes, benefits, risks, uses,
    fun_fact, confidence, author_email (all optional): only the fields you pass are changed
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  The updated plant record.

Examples:
  - "Fix the habitat description for plant <uuid>" -> id="<uuid>", habitat="..."

Error Handling:
  - Returns "Error: Plant <id> not found." if the id doesn't exist.
  - Returns "Error: ..." with the DB message if a value violates a constraint (e.g. empty common_name).`,
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
      const { id, response_format, ...rest } = params;
      const fields = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .from(PLANTS_TABLE)
        .update(fields)
        .eq("id", id)
        .select(PLANT_COLUMNS)
        .maybeSingle();

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }
      if (!data) {
        return { isError: true, content: [{ type: "text", text: `Error: Plant ${id} not found.` }] };
      }

      const plant = data as unknown as FloraPlant;
      return respond(
        response_format,
        `Updated plant record.\n\n${plantToMarkdown(plant)}`,
        response_format === ResponseFormat.JSON ? plant : plant
      );
    }
  );
}
