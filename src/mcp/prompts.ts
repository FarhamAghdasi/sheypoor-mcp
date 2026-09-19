import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "find_cheapest",
    "Find the cheapest listings for a product in a city.",
    {
      product: z.string().describe("Product name in Persian or English"),
      city: z.string().default("iran"),
      maxResults: z.string().default("5"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Find the ${args.maxResults} cheapest listings on Sheypoor for "${args.product}" in "${args.city}".\n\nSteps:\n1. Call search_listings with query="${args.product}", city="${args.city}", sort="cheapest".\n2. If fewer than ${args.maxResults} results, fetch more pages.\n3. For the top results, call get_listing to get full details.\n4. Present a table: title, price, location, phone, URL.\n5. Note any red flags (no phone, expired, suspicious price).`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "analyze_listing",
    "Analyze a Sheypoor listing in detail: price, seller, condition, red flags.",
    {
      listingId: z.string().describe("Listing ID"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze Sheypoor listing ${args.listingId}.\n\n1. Call get_listing with id="${args.listingId}".\n2. Summarize: title, price, location, seller, phone, condition.\n3. Compare the price against similar listings: call search_listings with the same product name and note whether this one is above/below average.\n4. Flag red flags: unverified phone, no reviews, suspiciously low price, vague description.\n5. Give a verdict: good deal / fair / overpriced.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "market_snapshot",
    "Compute price statistics for a category in a city.",
    {
      category: z.string().describe("Category ID or name"),
      city: z.string().default("iran"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Produce a market snapshot for category "${args.category}" in "${args.city}".\n\n1. Call search_categories to resolve the category ID if needed.\n2. Call search_listings_all with that categoryId, city="${args.city}", maxPages=3.\n3. Compute: count, min/max/median price, price distribution buckets.\n4. List the 5 cheapest and 5 most expensive (with URLs).\n5. Summarize in 3–4 sentences.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "compare_listings",
    "Compare several Sheypoor listings side by side.",
    {
      listingIds: z.string().describe("Comma-separated listing IDs"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Compare these Sheypoor listings: ${args.listingIds}.\n\n1. Call get_listing for each ID.\n2. Present a comparison table: title, price, location, seller rating, phone, condition, image count.\n3. Recommend which one to buy and why.`,
          },
        },
      ],
    }),
  );
}
