#!/usr/bin/env node
/**
 * MCP server for the Digital Flora botanical catalog.
 *
 * Wraps the app's Supabase `plants` table with focused, workflow-shaped
 * tools (not a raw CRUD passthrough) so an agent can browse the catalog,
 * log new finds, attach photos, and run the taxonomy-review workflow
 * without hand-writing SQL or violating the app's own conventions
 * (e.g. never marking a GBIF lookup "confirmed" without going through
 * flora_confirm_taxonomy).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerListPlants } from "./tools/list_plants.js";
import { registerGetPlant } from "./tools/get_plant.js";
import { registerAddPlant } from "./tools/add_plant.js";
import { registerUpdatePlant } from "./tools/update_plant.js";
import { registerAddPhoto } from "./tools/add_photo.js";
import { registerNeedsReview } from "./tools/needs_review.js";
import { registerConfirmTaxonomy } from "./tools/confirm_taxonomy.js";
import { registerCatalogStats } from "./tools/catalog_stats.js";

function requireEnv(): void {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    console.error(`ERROR: missing required environment variable(s): ${missing.join(", ")}`);
    console.error("See README.md for how to set these.");
    process.exit(1);
  }
}

function buildServer(): McpServer {
  const server = new McpServer({
    name: "digital-flora-mcp-server",
    version: "1.0.0",
  });

  registerListPlants(server);
  registerGetPlant(server);
  registerAddPlant(server);
  registerUpdatePlant(server);
  registerAddPhoto(server);
  registerNeedsReview(server);
  registerConfirmTaxonomy(server);
  registerCatalogStats(server);

  return server;
}

async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Digital Flora MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  const authToken = process.env.MCP_SERVER_TOKEN;
  if (!authToken) {
    console.error(
      "ERROR: MCP_SERVER_TOKEN is required when TRANSPORT=http. " +
        "This server holds your Supabase service_role key (bypasses RLS), so its /mcp " +
        "endpoint must never be reachable without a shared secret. Generate one " +
        "(e.g. `openssl rand -hex 32`) and set it here and in Claude's connector config."
    );
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  // No auth required: lets hosting platforms health-check the service.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Some hosting platforms (e.g. Railway) probe "/" by default when no
  // health-check path is configured; without a handler that 404s and the
  // deploy is reported failed even though the server is actually up.
  app.get("/", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/mcp", (req, res, next) => {
    const header = req.header("authorization") || "";
    const expected = `Bearer ${authToken}`;
    if (header !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });

  app.post("/mcp", async (req, res) => {
    // Stateless: a fresh server + transport per request avoids request-id
    // collisions across concurrent calls and keeps this deployable as a
    // plain serverless function.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.error(`Digital Flora MCP server running on http://localhost:${port}/mcp`);
  });
}

requireEnv();

const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
