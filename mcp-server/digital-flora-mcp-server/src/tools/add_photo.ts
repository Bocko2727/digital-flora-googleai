import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, PLANTS_TABLE, PLANT_COLUMNS, describeSupabaseError } from "../services/supabase.js";
import { plantIdField, responseFormatField } from "../schemas/common.js";
import { plantToMarkdown, respond } from "../services/format.js";
import { ResponseFormat } from "../types.js";
import type { FloraPhoto, FloraPlant } from "../types.js";

const InputSchema = z
  .object({
    id: plantIdField,
    url: z.string().url().describe("Public or signed URL of the already-uploaded photo (e.g. Supabase Storage URL)"),
    caption: z.string().max(500).optional(),
    taken_at: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("ISO 8601 timestamp the photo was taken, if known"),
    response_format: responseFormatField,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerAddPhoto(server: McpServer): void {
  server.registerTool(
    "flora_add_photo",
    {
      title: "Attach a photo to a Digital Flora plant",
      description: `Append a photo reference to a plant's photos array.

This tool does NOT upload image bytes - the photo must already be uploaded (e.g. to Supabase
Storage) and you pass its URL here. It reads the current photos array, appends the new entry,
and writes the array back, so concurrent adds to the SAME plant should not be run in parallel.

Args:
  - id (string, uuid, required): the plant to attach the photo to
  - url (string, required): URL of the uploaded photo
  - caption (string, optional): short description of the photo
  - taken_at (string, optional): ISO 8601 timestamp
  - response_format ('markdown' | 'json'): output format (default markdown)

Returns:
  The updated plant record with the new photo included in its photos array.

Examples:
  - "Attach this photo to the oregano record" -> id="<uuid>", url="https://.../photo.jpg"

Error Handling:
  - Returns "Error: Plant <id> not found." if the id doesn't exist.
  - Returns "Error: ..." if url is not a valid URL.`,
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

      const { data: existing, error: fetchError } = await supabase
        .from(PLANTS_TABLE)
        .select("id, photos")
        .eq("id", params.id)
        .maybeSingle();

      if (fetchError) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(fetchError) }] };
      }
      if (!existing) {
        return { isError: true, content: [{ type: "text", text: `Error: Plant ${params.id} not found.` }] };
      }

      const newPhoto: FloraPhoto = {
        url: params.url,
        ...(params.caption ? { caption: params.caption } : {}),
        ...(params.taken_at ? { taken_at: params.taken_at } : {}),
      };
      const currentPhotos = (existing.photos as FloraPhoto[] | null) ?? [];
      const updatedPhotos = [...currentPhotos, newPhoto];

      const { data, error } = await supabase
        .from(PLANTS_TABLE)
        .update({ photos: updatedPhotos })
        .eq("id", params.id)
        .select(PLANT_COLUMNS)
        .single();

      if (error) {
        return { isError: true, content: [{ type: "text", text: describeSupabaseError(error) }] };
      }

      const plant = data as unknown as FloraPlant;
      return respond(
        params.response_format,
        `Added photo (now ${plant.photos.length} total).\n\n${plantToMarkdown(plant)}`,
        params.response_format === ResponseFormat.JSON ? plant : plant
      );
    }
  );
}
