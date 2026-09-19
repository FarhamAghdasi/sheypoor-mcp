import { describe, it, expect, vi } from "vitest";
import { registerListingTools } from "../../src/mcp/tools/listing.js";
import { registerSearchTools } from "../../src/mcp/tools/search.js";
import { registerMetadataTools } from "../../src/mcp/tools/metadata.js";
import { registerAuthTools } from "../../src/mcp/tools/auth.js";
import { registerAccountTools } from "../../src/mcp/tools/account.js";
import type { SheypoorClient } from "../../src/client/index.js";

function createMockServer() {
  const tools: Record<string, unknown> = {};
  return {
    tool(name: string, _desc: string, _schema: unknown, handler: (args: any) => any) {
      tools[name] = handler;
    },
    tools,
  };
}

function createMockClient(overrides: Partial<SheypoorClient> = {}): SheypoorClient {
  return {
    listing: {
      detail: vi.fn().mockResolvedValue({ id: "1", title: "T", price: [], images: [] }),
      detailFromUrl: vi.fn(),
    },
    search: {
      page: vi.fn(),
      extractListings: vi.fn(),
    },
    meta: {
      categoriesCompact: vi.fn().mockResolvedValue([]),
      locations: vi.fn().mockResolvedValue({ data: { list: [] } }),
      popularSearches: vi.fn().mockResolvedValue([]),
      suggestions: vi.fn().mockResolvedValue([]),
    },
    auth: {
      start: vi.fn(),
      complete: vi.fn(),
      isAuthenticated: false,
    },
    account: {
      profile: vi.fn(),
      myListings: vi.fn(),
      myWallets: vi.fn().mockResolvedValue({ data: { wallets: [] } }),
    },
    chat: {
      rooms: vi.fn(),
      unread: vi.fn(),
    },
    bookmarks: {
      list: vi.fn(),
    },
    isAuthenticated: false,
    saveCookies: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  } as unknown as SheypoorClient;
}

describe("listing tools", () => {
  it("get_listing returns compacted detail", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    registerListingTools(server as any, cli);
    const res = await (server.tools as any)["get_listing"]({ id: 1 });
    expect(cli.listing.detail).toHaveBeenCalledWith(1);
    expect(res.content[0].text).toContain("T");
  });
});

describe("search tools", () => {
  it("search_listings returns mapped payload", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    cli.search.page = vi.fn().mockResolvedValue({ meta: { total: 1, p: 1 }, data: [] });
    cli.search.extractListings = vi.fn().mockReturnValue([]);
    registerSearchTools(server as any, cli);
    const res = await (server.tools as any)["search_listings"]({ query: "iphone", city: "tehran" });
    expect(cli.search.page).toHaveBeenCalledWith(expect.objectContaining({ city: "tehran", q: "iphone" }));
    const payload = JSON.parse(res.content[0].text);
    expect(payload.total).toBe(1);
  });
});

describe("metadata tools", () => {
  it("list_categories maps payload", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    cli.meta.categoriesCompact = vi.fn().mockResolvedValue([{ id: "1", name: "موبایل", slug: "mobile", children: [] }]);
    registerMetadataTools(server as any, cli);
    const res = await (server.tools as any)["list_categories"]({});
    const payload = JSON.parse(res.content[0].text);
    expect(payload.categories[0].name).toBe("موبایل");
  });

  it("list_cities returns not found when no match", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    cli.meta.locations = vi.fn().mockResolvedValue({ data: { list: [{ provinceID: 1, name: "Tehran", slug: "tehran", cities: [] }] } });
    registerMetadataTools(server as any, cli);
    const res = await (server.tools as any)["list_cities"]({ province: "isfahan" });
    expect(res.isError).toBe(true);
  });
});

describe("auth tools", () => {
  it("whoami returns not authenticated", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    registerAuthTools(server as any, cli);
    const res = await (server.tools as any)["whoami"]({});
    expect(res.isError).toBe(true);
  });

  it("logout calls cli.logout", async () => {
    const server = createMockServer();
    const cli = createMockClient();
    registerAuthTools(server as any, cli);
    const res = await (server.tools as any)["logout"]({});
    expect(cli.logout).toHaveBeenCalled();
    expect(res.content[0].text).toBe('{"ok":true}');
  });
});

describe("account tools", () => {
  it("get_my_wallets returns wallets when authenticated", async () => {
    const server = createMockServer();
    const cli = createMockClient({ isAuthenticated: true });
    registerAccountTools(server as any, cli);
    const res = await (server.tools as any)["get_my_wallets"]({});
    const payload = JSON.parse(res.content[0].text);
    expect(payload.wallets).toEqual([]);
  });
});
