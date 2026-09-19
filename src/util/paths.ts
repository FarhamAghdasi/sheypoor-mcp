import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface AppPaths {
  config: string;
  cache: string;
  data: string;
  log: string;
}

/**
 * OS-specific config/cache/data/log directories for sheypoor-mcp.
 *   Linux:   ~/.config/sheypoor-mcp
 *   macOS:   ~/Library/Application Support/sheypoor-mcp
 *   Windows: %APPDATA%\sheypoor-mcp
 */
export function getAppPaths(): AppPaths {
  const home = homedir();
  const os = platform();

  if (os === "win32") {
    const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    return {
      config: join(appData, "sheypoor-mcp"),
      cache: join(localAppData, "sheypoor-mcp", "cache"),
      data: join(localAppData, "sheypoor-mcp", "data"),
      log: join(localAppData, "sheypoor-mcp", "log"),
    };
  }

  if (os === "darwin") {
    const support = join(home, "Library", "Application Support", "sheypoor-mcp");
    return {
      config: support,
      cache: join(home, "Library", "Caches", "sheypoor-mcp"),
      data: join(support, "data"),
      log: join(home, "Library", "Logs", "sheypoor-mcp"),
    };
  }

  // linux / bsd
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  const xdgCache = process.env.XDG_CACHE_HOME ?? join(home, ".cache");
  const xdgData = process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
  const xdgState = process.env.XDG_STATE_HOME ?? join(home, ".local", "state");

  return {
    config: join(xdgConfig, "sheypoor-mcp"),
    cache: join(xdgCache, "sheypoor-mcp"),
    data: join(xdgData, "sheypoor-mcp"),
    log: join(xdgState, "sheypoor-mcp", "log"),
  };
}

export function defaultCookieFile(): string {
  return join(getAppPaths().config, "cookies.json");
}

export function defaultCacheFile(): string {
  return join(getAppPaths().cache, "cache.json");
}
