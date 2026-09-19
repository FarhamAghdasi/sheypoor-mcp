export const SITE = "https://www.sheypoor.com";
export const API = `${SITE}/api/v10.0.0`;
export const XMPP_WS = "wss://www.sheypoor.com/xmpp";
export const XMPP_DOMAIN = "im.mielse.com";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": DEFAULT_USER_AGENT,
  Accept: "application/json, text/html;q=0.9",
  "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
  Referer: `${SITE}/`,
  Origin: SITE,
};

export const JSONAPI_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
};

export const RSC_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  RSC: "1",
  Accept: "text/x-component",
};

export const LISTING_ID_RE = /-(\d+)\.html$/;
export const RSC_CHUNK_RE = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
