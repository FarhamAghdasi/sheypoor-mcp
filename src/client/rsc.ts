import { RSC_CHUNK_RE } from "./constants.js";

/**
 * Extract the escaped-string chunks from a Next.js RSC payload and
 * concatenate them into one big JSON-ish string.
 */
export function parseRscPayload(html: string): string {
  let out = "";
  for (const m of html.matchAll(RSC_CHUNK_RE)) {
    const escaped = m[1];
    if (!escaped) continue;
    try {
      out += JSON.parse(`"${escaped}"`) as string;
    } catch {
      // bad chunk — skip
    }
  }
  return out;
}

/**
 * Extract a balanced-brace JSON value starting at s[i].
 * Returns the parsed value (throws if unbalanced).
 */
export function balancedJson<T = unknown>(s: string, i: number): T {
  let depth = 0;
  let inStr = false;
  let esc = false;
  const start = i;
  for (let j = i; j < s.length; j++) {
    const ch = s[j]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(s.slice(start, j + 1)) as T;
      }
    }
  }
  throw new Error(`Unbalanced JSON starting at offset ${start}`);
}

const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

/** Extract every JSON-LD block from an HTML document. */
export function parseJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(LD_JSON_RE)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // malformed block, skip
    }
  }
  return out;
}

/**
 * Extract `publicListingDetails` from an SSR HTML page.
 * Returns null if not found.
 */
export function extractListingFromRsc(html: string): unknown | null {
  const payload = parseRscPayload(html);
  const m = /"queryKey":\["LOAD_LISTING",\s*"\d+"\]/.exec(payload);
  if (!m) return null;
  const dataIdx = payload.indexOf('"data":', m.index + m[0].length);
  if (dataIdx < 0) return null;
  try {
    const blob = balancedJson<Record<string, unknown>>(payload, dataIdx + '"data":'.length);
    return (blob as { data?: unknown }).data ?? blob;
  } catch {
    return null;
  }
}
