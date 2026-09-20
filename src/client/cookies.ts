import { log } from "../util/logger.js";
import type { CookieStorage } from "./cookie-storage.js";

export class CookieJar {
  constructor(private readonly storage: CookieStorage) {}

  set(name: string, value: string, expires?: number): void {
    this.storage.set(name, value, expires);
  }

  get(name: string): string | undefined {
    return this.storage.get(name);
  }

  has(name: string): boolean {
    return this.storage.get(name) !== undefined;
  }

  delete(name: string): void {
    this.storage.delete(name);
  }

  clear(): void {
    this.storage.clear();
  }

  toHeader(): string {
    const pairs: string[] = [];
    const keys = (this.storage as any).keys?.();
    if (!keys) return "";
    for (const name of keys) {
      const c = this.storage.get(name);
      if (!c) continue;
      pairs.push(`${name}=${c}`);
    }
    return pairs.join("; ");
  }

  toObject(): Record<string, string> {
    return (this.storage as any).toObject?.() ?? {};
  }

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

  save(): void {
    this.storage.save?.();
  }

  load(): void {
    this.storage.load?.();
  }

  destroy(): void {
    this.storage.destroy?.();
    this.clear();
  }

  get path(): string | undefined {
    return (this.storage as any).filePath;
  }
}
