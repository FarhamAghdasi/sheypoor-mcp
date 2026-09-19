import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SheypoorClient } from "../client/index.js";

/**
 * Expose reference data (categories, locations, versions) as MCP resources.
 * LLMs can read these once and keep them in context, avoiding repeated tool calls.
 */
export function registerResources(server: McpServer, cli: SheypoorClient): void {
  server.resource(
    "categories",
    "sheypoor://categories",
    {
      description: "The full Sheypoor category tree (2 levels).",
      mimeType: "application/json",
    },
    async (uri) => {
      const cats = await cli.meta.categoriesCompact();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(cats, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "locations",
    "sheypoor://locations",
    {
      description: "Province → city → district hierarchy for filtering.",
      mimeType: "application/json",
    },
    async (uri) => {
      const doc = await cli.meta.locations();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(doc.data, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "versions",
    "sheypoor://versions",
    {
      description: "Data version timestamps for cache invalidation.",
      mimeType: "application/json",
    },
    async (uri) => {
      const doc = await cli.meta.versions();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(doc.data, null, 2),
          },
        ],
      };
    },
  );
}
