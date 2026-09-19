import { API } from "./constants.js";
import type { HttpClient } from "./http.js";

export type ListingStatus = "all" | "published" | "draft" | "expired" | "pending" | "rejected";

export class AccountApi {
  constructor(private readonly http: HttpClient) {}

  profile() {
    return this.http
      .request<{ data: { type: string; id: string; attributes: Record<string, unknown> } }>(
        `${API}/user/profile-details`,
        { jsonapi: true },
      )
      .then((r) => r.data);
  }

  myListings(
    status: ListingStatus = "all",
    opts: { page?: number; size?: number; isShop?: boolean } = {},
  ) {
    return this.http.request<{
      data: Array<Record<string, unknown>>;
      meta: { total_items: number };
      links: { next?: string | null };
    }>(`${API}/user/listings/${status}`, {
      jsonapi: true,
      params: {
        isShop: String(opts.isShop ?? false),
        "page[number]": opts.page ?? 1,
        "page[size]": opts.size ?? 24,
      },
    });
  }

  async *iterateMyListings(status: ListingStatus = "all", size = 24) {
    let page = 1;
    for (;;) {
      const doc = await this.myListings(status, { page, size });
      if (!doc.data.length) return;
      yield* doc.data;
      if (!doc.links?.next) return;
      page += 1;
    }
  }

  myPackages(opts: { active?: boolean; isShop?: boolean } = {}) {
    return this.http.request<unknown>(`${API}/user/online-packages`, {
      jsonapi: true,
      params: {
        active: String(opts.active ?? true),
        isShop: String(opts.isShop ?? false),
      },
    });
  }

  buyerOrders(state: "active" | "inactive" = "active", page = 1, size = 20) {
    return this.http.request<unknown>(`${API}/newSecureTrade/service/buyer/orders`, {
      params: { p: page, page_size: size, state },
    });
  }

  sellerOrders(state: "active" | "inactive" = "active", page = 1, size = 20) {
    return this.http.request<unknown>(`${API}/newSecureTrade/service/seller/orders`, {
      params: { p: page, page_size: size, state },
    });
  }

  myPayments(page = 1, size = 16) {
    return this.http.request<unknown>(`${API}/user/payments`, {
      jsonapi: true,
      params: { "page[number]": page, "page[size]": size },
    });
  }

  myWallets() {
    return this.http.request<{
      success: boolean;
      data: {
        wallets: Array<{
          title: string;
          walletName: string;
          isActive: boolean;
          isDefault: boolean;
          logo?: string;
        }>;
      };
    }>(`${API}/user/wallets`);
  }
}
