import { CHARACTER_LIMIT } from "../constants.js";
import { ResponseFormat } from "../types.js";
import type { FloraPlant } from "../types.js";

export interface ListResult<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

export function buildListResult<T>(
  items: T[],
  total: number,
  offset: number
): ListResult<T> {
  const has_more = total > offset + items.length;
  return {
    total,
    count: items.length,
    offset,
    items,
    has_more,
    ...(has_more ? { next_offset: offset + items.length } : {}),
  };
}

/** Truncate a JSON-serialized payload if it would blow the context budget. */
export function truncateIfNeeded<T extends { items: unknown[] }>(
  payload: T
): { text: string; data: T } {
  let text = JSON.stringify(payload, null, 2);
  if (text.length <= CHARACTER_LIMIT) {
    return { text, data: payload };
  }

  const half = Math.max(1, Math.floor(payload.items.length / 2));
  const truncated = {
    ...payload,
    items: payload.items.slice(0, half),
    truncated: true,
    truncation_message: `Response truncated from ${payload.items.length} to ${half} items. Narrow your filters or use 'offset' to page through the rest.`,
  };
  text = JSON.stringify(truncated, null, 2);
  return { text, data: truncated as unknown as T };
}

function plantSummaryLine(p: FloraPlant): string {
  const family = p.family ? `, ${p.family}` : "";
  return `- **${p.common_name}** (_${p.latin_name}_${family}) — id: ${p.id} — confidence: ${p.confidence}, taxonomy: ${p.taxonomy_status}, photos: ${p.photos?.length ?? 0}`;
}

export function plantsToMarkdown(title: string, plants: FloraPlant[], total: number): string {
  if (plants.length === 0) {
    return `${title}\n\nNo plant records matched.`;
  }
  const lines = [`# ${title}`, "", `Showing ${plants.length} of ${total} records.`, ""];
  for (const p of plants) lines.push(plantSummaryLine(p));
  return lines.join("\n");
}

export function plantToMarkdown(p: FloraPlant): string {
  const lines = [
    `# ${p.common_name} (_${p.latin_name}_)`,
    "",
    `- **ID**: ${p.id}`,
    `- **Family**: ${p.family ?? "unknown"}`,
    `- **Confidence**: ${p.confidence}`,
    `- **Taxonomy status**: ${p.taxonomy_status}`,
    `- **Habitat**: ${p.habitat ?? "—"}`,
    `- **Lookalikes**: ${p.lookalikes ?? "—"}`,
    `- **Benefits**: ${p.benefits ?? "—"}`,
    `- **Risks**: ${p.risks ?? "—"}`,
    `- **Uses**: ${p.uses ?? "—"}`,
    `- **Fun fact**: ${p.fun_fact ?? "—"}`,
    `- **Photos**: ${p.photos?.length ?? 0}`,
    `- **Created**: ${new Date(p.created_at).toLocaleString()}`,
    `- **Updated**: ${new Date(p.updated_at).toLocaleString()}`,
  ];
  return lines.join("\n");
}

export function respond(
  format: ResponseFormat,
  markdown: string,
  structured: unknown
): { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown> } {
  if (format === ResponseFormat.JSON) {
    return {
      content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured as Record<string, unknown>,
    };
  }
  return {
    content: [{ type: "text", text: markdown }],
    structuredContent: structured as Record<string, unknown>,
  };
}
