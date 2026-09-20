import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { log } from "../util/logger.js";

export interface CookieStorage {
  get(name: string): string | undefined;
  set(name: string, value: string, expires?: number): void;
  delete(name: string): void;
  clear(): void;
  keys(): IterableIterator<string>;
  save?(): void;
  load?(): void;
  destroy?(): void;
  toObject?(): Record<string, string>;
}

interface StoredCookie {
  value: string;
  expires?: number;
}

export class FileCookieStorage implements CookieStorage {
  private cookies = new Map<string, StoredCookie>();

  constructor(private readonly filePath: string) {
    this.load();
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

  set(name: string, value: string, expires?: number): void {
    this.cookies.set(name, { value, expires });
  }

  delete(name: string): void {
    this.cookies.delete(name);
  }

  clear(): void {
    this.cookies.clear();
  }

  keys(): IterableIterator<string> {
    return this.cookies.keys();
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
    if (existsSync(this.filePath)) {
      try {
        unlinkSync(this.filePath);
      } catch (err) {
        log.warn({ err }, "failed to delete cookie file");
      }
    }
  }

  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, c] of this.cookies) out[name] = c.value;
    return out;
  }
}

export class MemoryCookieStorage implements CookieStorage {
  private cookies = new Map<string, StoredCookie>();

  get(name: string): string | undefined {
    const c = this.cookies.get(name);
    if (!c) return undefined;
    if (c.expires && c.expires * 1000 < Date.now()) {
      this.cookies.delete(name);
      return undefined;
    }
    return c.value;
  }

  set(name: string, value: string, expires?: number): void {
    this.cookies.set(name, { value, expires });
  }

  delete(name: string): void {
    this.cookies.delete(name);
  }

  clear(): void {
    this.cookies.clear();
  }

  keys(): IterableIterator<string> {
    return this.cookies.keys();
  }

  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, c] of this.cookies) out[name] = c.value;
    return out;
  }
}
