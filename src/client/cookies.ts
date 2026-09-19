import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { log } from "../util/logger.js";

interface StoredCookie {
  value: string;
  expires?: number; // unix seconds
}

/**
 * Minimal, deterministic cookie jar backed by a JSON file.
 *
 * We deliberately avoid tough-cookie / axios-cookiejar-support to keep the
 * dependency footprint small. Sheypoor's cookies are simple key/value pairs.
 */
export class CookieJar {
  private cookies = new Map<string, StoredCookie>();

  constructor(private readonly filePath?: string) {
    if (filePath && existsSync(filePath)) this.load();
  }

  set(name: string, value: string, expires?: number): void {
    this.cookies.set(name, { value, expires });
  }

  get(name: string): string | undefined {
    const c = this.cookies.get(name);
    if (!c) return undefined;
    if (c.expires && c.expires * 1000 < Date.now()) {
      this.cookies.delete(name);
      return undefined;
    }
    return c.value;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  delete(name: string): void {
    this.cookies.delete(name);
  }

  clear(): void {
    this.cookies.clear();
  }

  toHeader(): string {
    const pairs: string[] = [];
    for (const [name, c] of this.cookies) {
      if (c.expires && c.expires * 1000 < Date.now()) continue;
      pairs.push(`${name}=${encodeURIComponent(c.value)}`);
    }
    return pairs.join("; ");
  }

  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, c] of this.cookies) out[name] = c.value;
    return out;
  }

  /** Parse a Set-Cookie header and store the cookie. */
  absorbSetCookie(raw: string): void {
    const parts = raw.split(";").map((p) => p.trim());
    const [nameValue, ...attrs] = parts;
    if (!nameValue) return;
    const eq = nameValue.indexOf("=");
    if (eq < 0) return;
    const name = nameValue.slice(0, eq).trim();
    const value = decodeURIComponent(nameValue.slice(eq + 1).trim());

    let expires: number | undefined;
    for (const attr of attrs) {
      const [k, v] = attr.split("=").map((s) => s?.trim());
      if (!k || !v) continue;
      if (k.toLowerCase() === "max-age") {
        const secs = Number.parseInt(v, 10);
        if (!Number.isNaN(secs)) expires = Math.floor(Date.now() / 1000) + secs;
      } else if (k.toLowerCase() === "expires") {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) expires = Math.floor(t / 1000);
      }
    }
    this.set(name, value, expires);
  }

  load(): void {
    if (!this.filePath) return;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) this.set(k, v);
      log.debug({ count: this.cookies.size }, "loaded cookies");
    } catch (err) {
      log.warn({ err }, "failed to load cookies");
    }
  }

  save(): void {
    if (!this.filePath) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.toObject(), null, 2));
      log.debug({ path: this.filePath, count: this.cookies.size }, "saved cookies");
    } catch (err) {
      log.warn({ err }, "failed to save cookies");
    }
  }

  destroy(): void {
    this.clear();
    if (this.filePath && existsSync(this.filePath)) {
      try {
        unlinkSync(this.filePath);
      } catch (err) {
        log.warn({ err }, "failed to delete cookie file");
      }
    }
  }

  get path(): string | undefined {
    return this.filePath;
  }
}
