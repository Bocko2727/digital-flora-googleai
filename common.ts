import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, TAXONOMY_STATUSES } from "../constants.js";
import { ResponseFormat } from "../types.js";

export const responseFormatField = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export const paginationFields = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Maximum records to return (1-${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE})`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of records to skip, for pagination"),
};

export const plantIdField = z
  .string()
  .uuid("Must be a valid plant UUID, as returned by flora_list_plants or flora_add_plant")
  .describe("The plants.id UUID of the record");

export const taxonomyStatusField = z.enum(TAXONOMY_STATUSES);
