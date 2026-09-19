import { API } from "./constants.js";
import type { HttpClient } from "./http.js";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string | null;
  children: CategoryNode[];
}

export interface LocationCity {
  cityID: number;
  name: string;
  slug: string;
  districts: Array<{ districtID: number; name: string; slug: string }>;
}

export interface LocationProvince {
  provinceID: number;
  name: string;
  slug: string;
  cities: LocationCity[];
}

export class MetaApi {
  constructor(private readonly http: HttpClient) {}

  versions() {
    return this.http.request<{
      success: boolean;
      data: {
        locationsData: number;
        categoriesData: number;
        categoriesCompactData: number;
      };
    }>(`${API}/general/versions`);
  }

  categoriesCompactRaw() {
    return this.http.request<unknown>(`${API}/categories/compact`);
  }

  async categoriesCompact(): Promise<CategoryNode[]> {
    const raw = await this.categoriesCompactRaw();
    const list = unwrapList(raw);
    return list.map(normalizeCategory);
  }

  locations() {
    return this.http.request<{
      success: boolean;
      data: { version: number; list: LocationProvince[] };
    }>(`${API}/general/locations`);
  }

  popularSearches() {
    return this.http
      .request<{ data: Array<{ attributes: { title: string; link: string } }> }>(
        `${API}/search/popular-searches`,
        { jsonapi: true },
      )
      .then((r) => r.data ?? []);
  }

  suggestions(city: string, prefix: string) {
    return this.http
      .request<{ data: Array<{ attributes: { title: string; url: string; subtitle?: string } }> }>(
        `${API}/search/suggestion/${city}`,
        { params: { q: prefix }, jsonapi: true },
      )
      .then((r) => r.data ?? []);
  }
}

function unwrapList(doc: unknown): Array<Record<string, unknown>> {
  let cur: unknown = doc;
  while (cur && typeof cur === "object" && "data" in (cur as Record<string, unknown>)) {
    cur = (cur as Record<string, unknown>).data;
  }
  return Array.isArray(cur) ? (cur as Array<Record<string, unknown>>) : [];
}

function normalizeCategory(node: Record<string, unknown>): CategoryNode {
  const attrs = (node.attributes as Record<string, unknown>) ?? {};
  const name = (node.name ?? node.title ?? attrs.name ?? attrs.title ?? null) as string | null;
  const slug = (node.slug ?? attrs.slug ?? null) as string | null;
  let children = (node.children as Array<Record<string, unknown>> | undefined) ?? [];
  if (children.length === 0) {
    const rel = (node.relationships as Record<string, unknown> | undefined)?.children as
      | Record<string, unknown>
      | undefined;
    const data = rel?.data;
    if (Array.isArray(data)) children = data as Array<Record<string, unknown>>;
  }
  return {
    id: String(node.id),
    name: name ?? "(unnamed)",
    slug,
    children: children.map(normalizeCategory),
  };
}
