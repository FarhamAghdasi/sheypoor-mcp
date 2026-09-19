import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SheypoorClient } from "../../client/index.js";
import { registerAccountTools } from "./account.js";
import { registerAuthTools } from "./auth.js";
import { registerListingTools } from "./listing.js";
import { registerMetadataTools } from "./metadata.js";
import { registerSearchTools } from "./search.js";

export function registerAllTools(server: McpServer, cli: SheypoorClient): void {
  registerSearchTools(server, cli);
  registerListingTools(server, cli);
  registerMetadataTools(server, cli);
  registerAuthTools(server, cli);
  registerAccountTools(server, cli);
}
