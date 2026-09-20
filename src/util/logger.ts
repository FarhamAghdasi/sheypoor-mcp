const isNode = typeof process !== "undefined" && process.stdout != null;

let _log: any;
if (isNode) {
  const pino = await import("pino");
  _log =
    typeof pino.destination === "function"
      ? pino.default(
          {
            level: process.env.SHEYPOOR_LOG_LEVEL ?? "info",
            base: undefined,
            timestamp: pino.stdTimeFunctions.isoTime,
          },
          pino.destination(2),
        )
      : {
          debug: (..._args: unknown[]) => {},
          info: (..._args: unknown[]) => {},
          warn: (..._args: unknown[]) => {},
          error: (..._args: unknown[]) => {},
          fatal: (..._args: unknown[]) => {},
        };
} else {
  _log = {
    debug: (..._args: unknown[]) => {},
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
    fatal: (..._args: unknown[]) => {},
  };
}

export const log = _log;
export type Logger = typeof log;
