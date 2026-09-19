import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SheypoorClient } from "../../client/index.js";
import { compactListing } from "../formatting.js";

export function registerSearchTools(server: McpServer, cli: SheypoorClient) {
  server.tool(
    "search_listings",
    "Search Sheypoor listings. Returns one page of results (default 24). " +
      "Supports free-text query, city, category, region, price range, and sorting.",
    {
      query: z.string().optional().describe("Free-text query (Persian supported)"),
      city: z.string().default("iran").describe("City slug, e.g. 'iran', 'tehran', 'amol'"),
      categoryId: z.number().int().optional().describe("Leaf category ID"),
      regionId: z.number().int().optional().describe("Province ID"),
      cityId: z.number().int().optional().describe("City ID (from list_cities)"),
      neighbourhoodIds: z.array(z.number().int()).optional(),
      minPrice: z.number().int().optional().describe("Minimum price in Toman"),
      maxPrice: z.number().int().optional().describe("Maximum price in Toman"),
      sort: z
        .enum(["newest", "cheapest", "expensive", "nearest"])
        .default("newest")
        .describe("Sort order"),
      page: z.number().int().min(1).default(1),
    },
    async (args) => {
      const res = await cli.search.page({
        city: args.city,
        q: args.query,
        categoryId: args.categoryId,
        regionId: args.regionId,
        cityId: args.cityId,
        neighbourhoodIds: args.neighbourhoodIds,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        sort: args.sort,
        page: args.page,
      });

      const listings = cli.search.extractListings(res).map(compactListing);
      const payload = {
        total: res.meta?.total ?? null,
        page: res.meta?.p ?? args.page,
        items_per_page: res.meta?.items_per_page ?? null,
        next_cursor: res.meta?.f ?? null,
        count: listings.length,
        listings,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  server.tool(
    "search_listings_all",
    "Search Sheypoor listings and auto-paginate. Returns a merged list of up to N pages. " +
      "Use this when the user wants 'all' or 'many' results.",
    {
      query: z.string().optional(),
      city: z.string().default("iran"),
      categoryId: z.number().int().optional(),
      regionId: z.number().int().optional(),
      minPrice: z.number().int().optional(),
      maxPrice: z.number().int().optional(),
      sort: z.enum(["newest", "cheapest", "expensive", "nearest"]).default("newest"),
      maxPages: z.number().int().min(1).max(10).default(3),
    },
    async (args) => {
      const listings = [];
      for await (const l of cli.search.iterate(
        {
          city: args.city,
          q: args.query,
          categoryId: args.categoryId,
          regionId: args.regionId,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          sort: args.sort,
        },
        args.maxPages,
      )) {
        listings.push(compactListing(l));
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: listings.length, listings }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_search_suggestions",
    "Get autocomplete suggestions for a search prefix in a given city.",
    {
      city: z.string().default("iran"),
      prefix: z.string().min(1),
    },
    async (args) => {
      const items = await cli.meta.suggestions(args.city, args.prefix);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ suggestions: items.map((i) => i.attributes.title) }, null, 2),
          },
        ],
      };
    },
  );

  server.tool("get_popular_searches", "Get trending search terms on Sheypoor.", {}, async () => {
    const items = await cli.meta.popularSearches();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ popular: items.map((i) => i.attributes.title) }, null, 2),
        },
      ],
    };
  });
}
