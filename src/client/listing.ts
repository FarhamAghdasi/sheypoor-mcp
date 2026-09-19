import { API, LISTING_ID_RE } from "./constants.js";
import type { HttpClient } from "./http.js";
import {
  type ListingDetail,
  ListingDetailSchema,
  type NormalizedPrice,
  type Price,
} from "./models.js";
import { extractListingFromRsc, parseJsonLd } from "./rsc.js";

export interface ListingApiResponse {
  meta?: { seo?: Record<string, unknown> };
  links?: { self?: string };
  data: unknown;
}

export class ListingApi {
  constructor(private readonly http: HttpClient) {}

  async raw(listingId: string | number): Promise<ListingApiResponse> {
    return this.http.request<ListingApiResponse>(`${API}/listings/${listingId}`);
  }

  async detail(listingId: string | number): Promise<ListingDetail> {
    const doc = await this.raw(listingId);
    return this.normalize(doc.data);
  }

  async detailFromUrl(url: string): Promise<ListingDetail> {
    const id = extractListingId(url);
    if (!id) throw new Error(`No listing ID in URL: ${url}`);
    return this.detail(id);
  }

  /**
   * SSR / RSC fallback. Returns null if the page can't be parsed.
   */
  async detailFromSsr(url: string): Promise<ListingDetail | null> {
    const html = await this.http.request<string>(url, { jsonapi: false });
    const fromRsc = extractListingFromRsc(html);
    if (fromRsc) {
      try {
        return this.normalize(fromRsc);
      } catch {
        // fall through to JSON-LD
      }
    }
    const blocks = parseJsonLd(html);
    const product = blocks.find(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        ["Product", "ItemPage"].includes((b as Record<string, unknown>)["@type"] as string),
    );
    if (!product) return null;
    return this.normalizeFromJsonLd(product as Record<string, unknown>);
  }

  private normalize(payload: unknown): ListingDetail {
    // Current API shape wraps fields under `attributes`.
    const p = payload as Record<string, unknown>;
    const flat = (p.attributes as Record<string, unknown>) ?? p;
    const merged = { ...flat, id: p.id ?? flat.id };
    return ListingDetailSchema.parse(merged);
  }

  private normalizeFromJsonLd(doc: Record<string, unknown>): ListingDetail {
    return ListingDetailSchema.parse({
      id: String(doc.sku ?? doc["@id"] ?? ""),
      title: String(doc.name ?? ""),
      url: String(doc.url ?? ""),
      description: String(doc.description ?? ""),
      seller: { name: String((doc.seller as Record<string, unknown>)?.name ?? "") },
      images: Array.isArray(doc.image)
        ? (doc.image as Array<Record<string, unknown>>).map((i) => ({
            source: { desktop: String(i.contentUrl ?? "") },
          }))
        : [],
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractListingId(urlOrSlug: string): string | null {
  const path = decodeURIComponent(urlOrSlug.split("?")[0] ?? "");
  const m = LISTING_ID_RE.exec(path);
  return m?.[1] ?? null;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toAsciiDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (c) => {
    const i = FA_DIGITS.indexOf(c);
    if (i >= 0) return String(i);
    return String(AR_DIGITS.indexOf(c));
  });
}

export function toPersianDigits(s: string): string {
  return s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]!);
}

export function normalizePrice(p: Price): NormalizedPrice {
  const rawAmount = p.amount == null ? "" : String(p.amount);
  const currency = p.currency ?? "";
  const ascii = toAsciiDigits(rawAmount).replace(/[,\s]/g, "");
  const raw = `${rawAmount} ${currency}`.trim();

  if (!/^\d+$/.test(ascii)) {
    return { amount: null, currency: null, negotiable: true, display: raw, raw };
  }
  const isToman = currency.includes("تومان");
  const isRial = currency.includes("ریال");
  return {
    amount: Number.parseInt(ascii, 10),
    currency: isToman ? "IRT" : isRial ? "IRR" : null,
    negotiable: false,
    display: raw,
    raw,
  };
}

/** Rewrite any CDN image URL to the largest available variant. */
export function fullSizeImage(url: string): string {
  return url.replace(/\/\d+x\d+_[A-Za-z]+\//, "/1500x1125_Sw/");
}
