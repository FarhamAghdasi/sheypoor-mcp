import { log } from "../util/logger.js";
import { TokenBucket, sleep } from "../util/throttle.js";
import { DEFAULT_HEADERS, JSONAPI_HEADERS } from "./constants.js";
import { CookieJar } from "./cookies.js";
import { FileCookieStorage, MemoryCookieStorage } from "./cookie-storage.js";
import {
  SheypoorAuthError,
  SheypoorError,
  SheypoorNotFound,
  SheypoorRateLimitError,
} from "./errors.js";

export interface HttpClientOptions {
  cookieFile?: string;
  cookieStorage?: CookieJar;
  timeoutMs?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  userAgent?: string;
  maxRetries?: number;
  rateCapacity?: number;
  rateRefillPerSec?: number;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  jsonapi?: boolean;
  retry?: boolean;
}

interface FetchContext {
  url: string;
  response: Response;
}

export class HttpClient {
  readonly cookies: CookieJar;
  private readonly timeoutMs: number;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxRetries: number;
  private readonly bucket: TokenBucket;
  private userAgent: string;

  constructor(opts: HttpClientOptions = {}) {
    if (opts.cookieStorage) {
      this.cookies = opts.cookieStorage;
    } else if (opts.cookieFile) {
      this.cookies = new CookieJar(new FileCookieStorage(opts.cookieFile));
    } else {
      this.cookies = new CookieJar(new MemoryCookieStorage());
    }
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.minDelayMs = opts.minDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 1_500;
    this.maxRetries = opts.maxRetries ?? 3;
    this.userAgent = opts.userAgent ?? DEFAULT_HEADERS["User-Agent"]!;
    this.bucket = new TokenBucket(opts.rateCapacity ?? 5, opts.rateRefillPerSec ?? 1);
  }

  setUserAgent(ua: string): void {
    this.userAgent = ua;
  }

  private buildUrl(url: string, params?: RequestOptions["params"]): string {
    if (!params) return url;
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  async request<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
    const method = (opts.method ?? "GET").toUpperCase();
    const finalUrl = this.buildUrl(url, opts.params);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.bucket.take();
      await sleep(this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs));

      const headers: Record<string, string> = {
        ...(opts.jsonapi ? JSONAPI_HEADERS : DEFAULT_HEADERS),
        "User-Agent": this.userAgent,
        ...opts.headers,
      };

      const cookieHeader = this.cookies.toHeader();
      if (cookieHeader) headers.Cookie = cookieHeader;

      if (opts.body !== undefined && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }

      let response: Response;
      try {
        response = await fetch(finalUrl, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: "follow",
        });
      } catch (err) {
        if (attempt >= this.maxRetries) {
          throw new SheypoorError(`Network error for ${finalUrl}`, { cause: err });
        }
        log.warn({ url: finalUrl, attempt, err }, "network error, retrying");
        await sleep(500 * 2 ** attempt);
        continue;
      }

      this.absorbCookies(response);

      if (response.status === 401) {
        const respText = await response.text().catch(() => "failed to read body");
        log.error(
          {
            url: finalUrl,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            cookies: this.cookies.toObject(),
            cookieHeader: this.cookies.toHeader(),
            body: respText,
            opts,
          },
          "401 Unauthorized"
        );
        throw new SheypoorAuthError(`401 Unauthorized: ${finalUrl}`);
      }
      if (response.status === 404) throw new SheypoorNotFound(`404 Not Found: ${finalUrl}`);
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "0", 10);
        if (attempt >= this.maxRetries) {
          throw new SheypoorRateLimitError(`429 Too Many Requests: ${finalUrl}`, retryAfter);
        }
        const waitMs = (retryAfter || 2 ** attempt) * 1000;
        log.warn({ url: finalUrl, retryAfter, attempt }, "rate limited, backing off");
        await sleep(waitMs);
        continue;
      }
      if (response.status >= 500 && attempt < this.maxRetries) {
        log.warn({ url: finalUrl, status: response.status, attempt }, "5xx, retrying");
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        throw new SheypoorError(`HTTP ${response.status} for ${finalUrl}`);
      }

      return this.parseBody<T>(response);
    }

    throw new SheypoorError(`Exhausted retries for ${finalUrl}`);
  }

  private async parseBody<T>(response: Response): Promise<T> {
    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || ct.includes("application/vnd.api+json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  private absorbCookies(response: Response): void {
    const anyHeaders = response.headers as unknown as { getSetCookie?: () => string[] };
    const setCookies =
      typeof anyHeaders.getSetCookie === "function"
        ? anyHeaders.getSetCookie()
        : (() => {
            const single = response.headers.get("set-cookie");
            return single ? [single] : [];
          })();

    for (const raw of setCookies) this.cookies.absorbSetCookie(raw);
  }

  saveCookies(): void {
    this.cookies.save();
  }

  loadCookies(): void {
    this.cookies.load();
  }

  clearCookies(): void {
    this.cookies.destroy();
  }
}
