import { API } from "./constants.js";
import type { HttpClient } from "./http.js";

export class BookmarksApi {
  constructor(private readonly http: HttpClient) {}

  list(page = 1, size = 24) {
    return this.http.request<{
      data: Array<Record<string, unknown>>;
      meta: { total_items: number };
    }>(`${API}/user/favorites`, {
      jsonapi: true,
      params: { "page[number]": page, "page[size]": size },
    });
  }
}
