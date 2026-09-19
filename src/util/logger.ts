import pino from "pino";

/**
 * Structured logger — ALWAYS writes to stderr.
 *
 * The MCP stdio transport reserves stdout for JSON-RPC frames, so any
 * accidental `console.log` or `process.stdout.write` will corrupt the
 * stream and crash the host. This logger never touches stdout.
 */
export const log = pino(
  {
    level: process.env.SHEYPOOR_LOG_LEVEL ?? "info",
    base: undefined, // drop pid/hostname — noisy in MCP
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.destination(2),
);

export type Logger = typeof log;
