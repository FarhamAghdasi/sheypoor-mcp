#!/usr/bin/env node
import { runStdio } from "./mcp/server.js";
import { log } from "./util/logger.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write("sheypoor-mcp 0.1.0\n");
    process.exit(0);
  }

  try {
    await runStdio();
  } catch (err) {
    log.fatal({ err }, "fatal error");
    process.exit(1);
  }
}

function printHelp(): void {
  process.stdout.write(
    `sheypoor-mcp — MCP server for Sheypoor

Usage:
  sheypoor-mcp                # run stdio transport (for Claude Desktop, Cursor, etc.)
  sheypoor-mcp --help         # show this help
  sheypoor-mcp --version      # print version

Environment:
  SHEYPOOR_COOKIE_FILE        Cookie jar path (default: OS config dir)
  SHEYPOOR_LOG_LEVEL          pino level: trace|debug|info|warn|error (default: info)
  SHEYPOOR_TIMEOUT_MS         HTTP timeout in ms (default: 20000)
  SHEYPOOR_MIN_DELAY_MS       Min throttle (default: 500)
  SHEYPOOR_MAX_DELAY_MS       Max throttle (default: 1500)

Docs: https://github.com/farhamaghdasi/sheypoor-mcp
`,
  );
}

void main();
