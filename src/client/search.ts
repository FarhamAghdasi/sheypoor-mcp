import { API } from "./constants.js";
import type { HttpClient } from "./http.js";
import type { Attribute, Listing, Price, SearchResponse } from "./models.js";

export type SortMode = "newest" | "cheapest" | "expensive" | "nearest";

const SORT_CODE: Record<SortMode, string> = {
  newest: "n",
  cheapest: "pa",
  expensive: "pd",
  nearest: "am",
};

export interface SearchParams {
  city?: string;
  q?: string;
  page?: number;
  cursor?: string;
  categoryId?: number;
  cityId?: number;
  regionId?: number;
  neighbourhoodIds?: number[];
  sort?: SortMode;
  minPrice?: number;
  maxPrice?: number;
  brands?: number | string;
  withImage?: boolean;
  extra?: Record<string, string | number | boolean>;
}

export class SearchApi {
  constructor(private readonly http: HttpClient) {}

  async page(params: SearchParams): Promise<SearchResponse> {
    const city = params.city ?? "iran";
    const query: Record<string, string | number | boolean | undefined> = {
      p: params.page ?? 1,
    };
    if (params.q) query.q = params.q;
    if (params.cursor) query.f = params.cursor;
    if (params.categoryId !== undefined) query.c = params.categoryId;
    if (params.cityId !== undefined) query.ct = params.cityId;
    if (params.regionId !== undefined) query.r = params.regionId;
    if (params.neighbourhoodIds) {
      params.neighbourhoodIds.forEach((id, i) => {
        query[`nh[${i}]`] = id;
      });
    }
    if (params.sort) query.o = SORT_CODE[params.sort];
    if (params.minPrice !== undefined) query.mnp = params.minPrice;
    if (params.maxPrice !== undefined) query.mxp = params.maxPrice;
    if (params.brands !== undefined) query.brands = params.brands;
    if (params.withImage) query.wi = "true";
    if (params.extra) Object.assign(query, params.extra);

    return this.http.request<SearchResponse>(`${API}/search/${city}`, { params: query });
  }

  /** Yield every listing across pages, following meta.f. */
  async *iterate(params: SearchParams, maxPages = 20): AsyncGenerator<Listing> {
    let cursor: string | undefined;
    for (let page = 1; page <= maxPages; page++) {
      const res = await this.page({ ...params, page, cursor });
      let count = 0;
      for (const listing of this.extractListings(res)) {
        count++;
        yield listing;
      }
      cursor = res.meta?.f;
      if (!cursor || count === 0) return;
    }
  }

  extractListings(res: SearchResponse): Listing[] {
    const out: Listing[] = [];
    for (const group of res.data as Array<Record<string, unknown>>) {
      const type = group.type as string | undefined;
      if (type === "listingGroup" || type === "vip") {
        const items = (group.items as Array<Record<string, unknown>>) ?? [];
        for (const item of items) out.push(this.toListing(item));
      } else if (type === "normal" || type === "paidEngagement") {
        out.push(this.toListing(group));
      }
    }
    return out;
  }

  private toListing(item: Record<string, unknown>): Listing {
    const a = (item.attributes as Record<string, unknown>) ?? {};
    return {
      id: String(item.id),
      type: String(item.type ?? "normal"),
      title: String(a.title ?? ""),
      url: String(a.url ?? ""),
      price: (a.price as Price[]) ?? [],
      location: (a.location as string | null) ?? null,
      categoryId: (a.categoryId as number | null) ?? null,
      imageCount: Number(a.imageCount ?? 0),
      videoCount: Number(a.videoCount ?? 0),
      telephone: (a.telephone as string | null) ?? null,
      attributes: ((item.fullAttributes ?? a.attributes) as Attribute[]) ?? [],
      raw: item,
    };
  }
}
