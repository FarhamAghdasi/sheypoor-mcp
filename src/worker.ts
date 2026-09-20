import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MemoryCookieStorage, FileCookieStorage } from "./client/cookie-storage.js";
import { CookieJar } from "./client/cookies.js";
import { SheypoorClient } from "./client/index.js";
import { registerPrompts } from "./mcp/prompts.js";
import { registerResources } from "./mcp/resources.js";
import { registerAllTools } from "./mcp/tools/index.js";

export default {
  async fetch(_request: Request, _env: unknown, _ctx: unknown): Promise<Response> {
    const client = new SheypoorClient({
      cookieStorage: new CookieJar(new MemoryCookieStorage()),
    });

    const server = new McpServer({ name: "sheypoor", version: "0.1.0" });

    registerAllTools(server, client);
    registerResources(server, client);
    registerPrompts(server);

    const mod = await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");
    const transport = new mod.WebStandardStreamableHTTPServerTransport();

    await server.connect(transport);
    return transport.handleRequest(_request);
  },
};
