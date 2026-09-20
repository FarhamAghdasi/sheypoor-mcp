export interface AppPaths {
  config: string;
  cache: string;
  data: string;
  log: string;
}

const isNode = typeof process !== "undefined" && process.env !== undefined;

export function getAppPaths(): AppPaths {
  if (!isNode) {
    return {
      config: "/tmp/sheypoor-mcp",
      cache: "/tmp/sheypoor-mcp/cache",
      data: "/tmp/sheypoor-mcp/data",
      log: "/tmp/sheypoor-mcp/log",
    };
  }

  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
  const platform = process.env.OSTYPE ?? process.platform;

  if (platform === "win32") {
    const appData = process.env.APPDATA ?? `${home}/AppData/Roaming`;
    const localAppData = process.env.LOCALAPPDATA ?? `${home}/AppData/Local`;
    return {
      config: `${appData}/sheypoor-mcp`,
      cache: `${localAppData}/sheypoor-mcp/cache`,
      data: `${localAppData}/sheypoor-mcp/data`,
      log: `${localAppData}/sheypoor-mcp/log`,
    };
  }

  if (platform === "darwin") {
    const support = `${home}/Library/Application Support/sheypoor-mcp`;
    return {
      config: support,
      cache: `${home}/Library/Caches/sheypoor-mcp`,
      data: `${support}/data`,
      log: `${home}/Library/Logs/sheypoor-mcp`,
    };
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME ?? `${home}/.config`;
  const xdgCache = process.env.XDG_CACHE_HOME ?? `${home}/.cache`;
  const xdgData = process.env.XDG_DATA_HOME ?? `${home}/.local/share`;
  const xdgState = process.env.XDG_STATE_HOME ?? `${home}/.local/state`;

  return {
    config: `${xdgConfig}/sheypoor-mcp`,
    cache: `${xdgCache}/sheypoor-mcp`,
    data: `${xdgData}/sheypoor-mcp`,
    log: `${xdgState}/sheypoor-mcp/log`,
  };
}

export function defaultCookieFile(): string {
  return `${getAppPaths().config}/cookies.json`;
}

export function defaultCacheFile(): string {
  return `${getAppPaths().cache}/cache.json`;
}
