import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SheypoorClient } from "../../client/index.js";
import { compactDetail } from "../formatting.js";

export function registerListingTools(server: McpServer, cli: SheypoorClient) {
  server.tool(
    "get_listing",
    "Fetch full details of a Sheypoor listing by numeric ID. " +
      "Returns title, price, seller, images, description, breadcrumbs, phone, actions.",
    {
      id: z.union([z.string(), z.number()]).describe("Listing ID"),
    },
    async (args) => {
      const detail = await cli.listing.detail(args.id);
      return {
        content: [{ type: "text", text: JSON.stringify(compactDetail(detail), null, 2) }],
      };
    },
  );

  server.tool(
    "get_listing_from_url",
    "Fetch full details of a Sheypoor listing from its canonical URL.",
    {
      url: z.string().url().describe("Canonical listing URL (ends in -<id>.html)"),
    },
    async (args) => {
      const detail = await cli.listing.detailFromUrl(args.url);
      return {
        content: [{ type: "text", text: JSON.stringify(compactDetail(detail), null, 2) }],
      };
    },
  );

  server.tool(
    "get_listing_images",
    "Return only the full-size image URLs for a listing.",
    {
      id: z.union([z.string(), z.number()]),
    },
    async (args) => {
      const detail = await cli.listing.detail(args.id);
      const images = (detail.images ?? []).map((i) =>
        fullSize(i.source?.desktop ?? i.source?.mobile ?? ""),
      );
      return {
        content: [{ type: "text", text: JSON.stringify({ images }, null, 2) }],
      };
    },
  );
}

function fullSize(url: string): string {
  return url.replace(/\/\d+x\d+_[A-Za-z]+\//, "/1500x1125_Sw/");
}
