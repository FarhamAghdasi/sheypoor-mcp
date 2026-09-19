import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SheypoorClient } from "../client/index.js";
import { log } from "../util/logger.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerAllTools } from "./tools/index.js";

export interface CreateServerOptions {
  name?: string;
  version?: string;
  client?: SheypoorClient;
}

export interface RunningServer {
  server: McpServer;
  client: SheypoorClient;
  shutdown: () => Promise<void>;
}

export async function createServer(opts: CreateServerOptions = {}): Promise<RunningServer> {
  const name = opts.name ?? "sheypoor";
  const version = opts.version ?? "0.1.0";

  const client = opts.client ?? new SheypoorClient();

  const server = new McpServer({ name, version });

  registerAllTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  log.info({ name, version }, "server initialized");

  return {
    server,
    client,
    async shutdown() {
      try {
        await server.close();
      } catch (err) {
        log.warn({ err }, "error closing server");
      }
    },
  };
}

export async function runStdio(opts: CreateServerOptions = {}): Promise<void> {
  const { server, shutdown, client } = await createServer(opts);
  const transport = new StdioServerTransport();

  // Save cookies on exit so login survives restarts
  const onSignal = async (signal: string) => {
    log.info({ signal }, "shutting down");
    client.saveCookies();
    await shutdown();
    process.exit(0);
  };
  process.on("SIGINT", () => void onSignal("SIGINT"));
  process.on("SIGTERM", () => void onSignal("SIGTERM"));

  await server.connect(transport);
  log.info("stdio transport connected");
}
