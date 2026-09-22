import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, PLANT_COLUMNS, describeSupabaseError } from "../services/supabase.js";
import { responseFormatField } from "../schemas/common.js";
import { plantToMarkdown, respond } from "../services/format.js";
import { ResponseFormat } from "../types.js";
import type { FloraPlant } from "../types.js";

const InputSchema = z
  .object({
    common_name: z.string().trim().min(1, "common_name is required").max(200),
    latin_name: z.string().trim().min(1, "latin_name is required").max(200),
    family: z.string().trim().max(200).optional(),
    habitat: z.string().max(2000).optional(),
    recognition: z.string().max(2000).optional(),
    lookalikes: z.string().max(2000).optional(),
    benefits: z.string().max(2000).optional(),
    risks: z.string().max(2000).optional(),
    uses: z.string().max(2000).optional(),
    fun_fact: z.string().max(2000).optional(),
    confidence: z.string().max(50).default("Вероятно"),
    author_email: z.string().email().optional(),
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerAddPlant(server: McpServer): void {
  server.registerTool(
    "flora_add_plant",
    {
      title: "Add a new Digital Flora plant record",
      description: `Create a new plant record in the Digital Flora catalog.

The record starts with an empty photos array and taxonomy_status="manual-unverified" (the DB
default). Use flora_add_photo afterwards to attach photos, and flora_confirm_taxonomy once the
species ID has been verified against GBIF or another source. This tool does NOT perform species
identification itself - it only stores what you give it.

Args:
  - common_name (string, required): everyday name for the plant
  - latin_name (string, required): scientific/binomial name
  - family (string, optional): botanical family
  - habitat, recognition, lookalikes, benefits, risks, uses, fun_fact (string, optional): free-text notes
  - confidence (string, optional): confidence label, e.g. "Сигурно" / "Вероятно" (default "Вероятно")
  - author_email (string, optional): email of whoever is logging this entry
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  The newly created plant record, including its generated id (uuid).

Examples:
  - "Add a new record for wild oregano, Origanum vulgare" -> common_name="Wild oregano", latin_name="Origanum vulgare"

Error Handling:
  - Returns "Error: ..." if common_name or latin_name is empty/whitespace (violates the DB check constraint),
    or if any other database constraint is violated.`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: Input) => {
      const supabase = getSupabaseClient();
      const { response_format, ...fields } = params;

      const { data, error } = await supabase
        .from(PLANTS_TABLE)
        .insert(fields)
        .select(PLANT_COLUMNS)
        .single();

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }

      const plant = data as unknown as FloraPlant;
      return respond(
        response_format,
        `Created plant record.\n\n${plantToMarkdown(plant)}`,
        response_format === ResponseFormat.JSON ? plant : plant
      );
    }
  );
}
