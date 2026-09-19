import { fullSizeImage, normalizePrice, toAsciiDigits } from "../client/listing.js";
import type { Listing, ListingDetail } from "../client/models.js";

/** Small, LLM-friendly view of a search result. */
export interface CompactListing {
  id: string;
  title: string;
  url: string;
  price: {
    amount: number | null;
    currency: string | null;
    negotiable: boolean;
    display: string;
  };
  location: string | null;
  categoryId: number | null;
  imageCount: number;
  phone: string | null;
}

export function compactListing(l: Listing): CompactListing {
  const p = l.price[0];
  const norm = p ? normalizePrice(p) : null;
  return {
    id: l.id,
    title: l.title,
    url: l.url,
    price: {
      amount: norm?.amount ?? null,
      currency: norm?.currency ?? null,
      negotiable: norm?.negotiable ?? true,
      display: norm?.display ?? "",
    },
    location: l.location,
    categoryId: l.categoryId,
    imageCount: l.imageCount,
    phone: l.telephone,
  };
}

/** Strip noisy fields from a ListingDetail before sending it to the LLM. */
export function compactDetail(d: ListingDetail) {
  const prices = (d.price ?? []).map(normalizePrice);
  const desc = stripHtml(d.description ?? "");
  return {
    id: d.id,
    title: d.title ?? "",
    url: d.url ?? "",
    description: desc.slice(0, 800) + (desc.length > 800 ? "…" : ""),
    description_truncated: desc.length > 800,
    price: prices,
    location: d.location ?? null,
    phone: d.phone ?? null,
    phone_verified: d.isPhoneVerified ?? false,
    shop_profile: d.isShopProfile ?? false,
    seller: d.seller
      ? {
          name: d.seller.name ?? null,
          url: d.seller.url ?? null,
          rating: (d.seller.rates as { score?: number } | null)?.score ?? null,
          review_count: (d.seller.rates as { count?: number } | null)?.count ?? null,
        }
      : null,
    breadcrumbs: (d.breadcrumbs ?? []).map((b) => ({
      title: b.title,
      type: b.type ?? null,
    })),
    attributes: (d.attributes ?? []).map((a) => ({
      key: a.key ?? null,
      value: a.value ?? null,
    })),
    images: (d.images ?? []).map((i) => fullSizeImage(i.source?.desktop ?? i.source?.mobile ?? "")),
    actions: d.actions ?? [],
    added_at: d.addedAt ?? null,
    time_passed_label: d.timePassedLabel ?? null,
  };
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function asciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u0600-\u06FF\d۰-۹٠-٩]/g, (c) => {
    if (/[۰-۹]/.test(c)) return toAsciiDigits(c);
    if (/[٠-٩]/.test(c)) return toAsciiDigits(c);
    return c; // keep Persian text, only normalize digits
  });
}
