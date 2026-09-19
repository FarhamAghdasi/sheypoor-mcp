import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SheypoorClient } from "../../client/index.js";

export function registerMetadataTools(server: McpServer, cli: SheypoorClient) {
  server.tool(
    "list_categories",
    "List top-level Sheypoor categories with their IDs and slugs.",
    {},
    async () => {
      const cats = await cli.meta.categoriesCompact();
      const payload = cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        child_count: c.children.length,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ categories: payload }, null, 2) }],
      };
    },
  );

  server.tool(
    "get_category_tree",
    "Return the full category tree (or a subtree if parentId is given).",
    {
      parentId: z.string().optional().describe("Optional parent category ID"),
    },
    async (args) => {
      const cats = await cli.meta.categoriesCompact();
      const filtered = args.parentId ? cats.filter((c) => c.id === args.parentId) : cats;
      return {
        content: [{ type: "text", text: JSON.stringify({ categories: filtered }, null, 2) }],
      };
    },
  );

  server.tool(
    "search_categories",
    "Fuzzy-search categories by name (Persian or English substring).",
    {
      query: z.string().min(1),
    },
    async (args) => {
      const cats = await cli.meta.categoriesCompact();
      const needle = args.query.trim().toLowerCase();
      const hits: Array<{ id: string; name: string; slug: string | null; path: string }> = [];
      const walk = (nodes: typeof cats, path: string[] = []) => {
        for (const n of nodes) {
          const hay = `${n.name} ${n.slug ?? ""}`.toLowerCase();
          if (hay.includes(needle)) {
            hits.push({
              id: n.id,
              name: n.name,
              slug: n.slug,
              path: [...path, n.name].join(" > "),
            });
          }
          walk(n.children, [...path, n.name]);
        }
      };
      walk(cats);
      return {
        content: [{ type: "text", text: JSON.stringify({ matches: hits.slice(0, 50) }, null, 2) }],
      };
    },
  );

  server.tool(
    "list_provinces",
    "List all Iranian provinces with their IDs and slugs.",
    {},
    async () => {
      const doc = await cli.meta.locations();
      const list = doc.data.list.map((p) => ({
        id: p.provinceID,
        name: p.name,
        slug: p.slug,
        city_count: p.cities.length,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ provinces: list }, null, 2) }],
      };
    },
  );

  server.tool(
    "list_cities",
    "List cities within a province (by province slug or name fragment).",
    {
      province: z.string().describe("Province slug or name fragment"),
    },
    async (args) => {
      const doc = await cli.meta.locations();
      const needle = args.province.trim().toLowerCase();
      const province = doc.data.list.find(
        (p) => p.slug.toLowerCase() === needle || p.name.toLowerCase().includes(needle),
      );
      if (!province) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: "province not found", province: args.province },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
      const cities = province.cities.map((c) => ({
        id: c.cityID,
        name: c.name,
        slug: c.slug,
        district_count: c.districts.length,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ province: province.name, cities }, null, 2),
          },
        ],
      };
    },
  );
}
