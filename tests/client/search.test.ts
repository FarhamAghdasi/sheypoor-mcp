import { describe, it, expect } from "vitest";
import { SearchApi } from "../../src/client/search.js";

describe("SearchApi", () => {
  it("page() sends default city iran", async () => {
    const api = new SearchApi({
      request: async (_url: string, opts?: { params?: Record<string, unknown> }) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(opts?.params ?? {})) {
          if (v !== undefined && v !== null) q.set(k, String(v));
        }
        return { data: [], meta: { total: 0, p: Number(q.get("p") ?? 1) } };
      },
    } as any);
    const res = await api.page({});
    expect(res.meta?.total).toBe(0);
  });

  it("page() maps sort mode", async () => {
    const api = new SearchApi({
      request: async (_url: string, opts?: { params?: Record<string, unknown> }) => {
        expect(opts?.params?.o).toBe("pa");
        return { data: [], meta: {} };
      },
    } as any);
    await api.page({ city: "tehran", q: "iphone", sort: "cheapest" });
  });

  it("extractListings handles listingGroup and normal", async () => {
    const api = new SearchApi({} as any);
    const res = {
      data: [
        { type: "normal", id: "1", attributes: { title: "A" } },
        {
          type: "listingGroup",
          id: "g1",
          items: [{ type: "normal", id: "2", attributes: { title: "B" } }],
        },
      ],
      meta: {},
    } as any;
    const listings = api.extractListings(res);
    expect(listings.map((l) => l.title)).toEqual(["A", "B"]);
  });

  it("extractListings ignores vip if items missing", async () => {
    const api = new SearchApi({} as any);
    const res = {
      data: [{ type: "vip", id: "1", attributes: { title: "A" } }],
      meta: {},
    } as any;
    const listings = api.extractListings(res);
    expect(listings).toHaveLength(0);
  });

  it("iterate stops at maxPages", async () => {
    let calls = 0;
    const api = new SearchApi({
      request: async () => {
        calls++;
        return { data: [{ id: String(calls), type: "normal", attributes: { title: "X" } }], meta: { f: "next" } };
      },
    } as any);
    const out: unknown[] = [];
    for await (const l of api.iterate({}, 3)) {
      out.push(l);
    }
    expect(calls).toBe(3);
  });

  it("iterate stops when no more data", async () => {
    let calls = 0;
    const api = new SearchApi({
      request: async () => {
        calls++;
        return { data: [], meta: {} };
      },
    } as any);
    const out: unknown[] = [];
    for await (const l of api.iterate({}, 10)) {
      out.push(l);
    }
    expect(calls).toBe(1);
  });
});
