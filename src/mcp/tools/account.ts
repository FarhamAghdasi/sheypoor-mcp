import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SheypoorClient } from "../../client/index.js";

export function registerAccountTools(server: McpServer, cli: SheypoorClient) {
  server.tool(
    "get_my_listings",
    "List the authenticated user's listings. Requires login.",
    {
      status: z
        .enum(["all", "published", "draft", "expired", "pending", "rejected"])
        .default("all"),
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(48).default(24),
    },
    async (args) => {
      ensureAuth(cli);
      const doc = await cli.account.myListings(args.status, {
        page: args.page,
        size: args.size,
      });
      const listings = doc.data.map((item) => {
        const a = (item.attributes as Record<string, unknown>) ?? {};
        return {
          id: String(item.id),
          title: a.title,
          url: a.url,
          status: (a.moderationStatus as Record<string, unknown> | undefined)?.status,
        };
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { total: doc.meta.total_items, count: listings.length, listings },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_my_bookmarks",
    "List the authenticated user's saved/bookmarked listings.",
    {
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(48).default(24),
    },
    async (args) => {
      ensureAuth(cli);
      const doc = await cli.bookmarks.list(args.page, args.size);
      const listings = doc.data.map((item) => {
        const a = (item.attributes as Record<string, unknown>) ?? {};
        return { id: String(item.id), title: a.title, url: a.url };
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: doc.meta.total_items, listings }, null, 2),
          },
        ],
      };
    },
  );

  server.tool("get_my_wallets", "List the authenticated user's payment wallets.", {}, async () => {
    ensureAuth(cli);
    const doc = await cli.account.myWallets();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ wallets: doc.data.wallets }, null, 2),
        },
      ],
    };
  });

  server.tool(
    "get_chat_rooms",
    "List the authenticated user's chat rooms (in-app messaging).",
    {
      page: z.number().int().min(1).default(1),
    },
    async (args) => {
      ensureAuth(cli);
      const data = await cli.chat.rooms(args.page);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: data.total,
                count: data.list.length,
                rooms: data.list.map((r) => ({
                  listing_id: r.id,
                  title: r.title,
                  last_message: r.msg,
                  unread: r.unread,
                  is_owner: r.is_owner,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool("get_chat_unread", "Return the number of unread chat messages.", {}, async () => {
    ensureAuth(cli);
    const n = await cli.chat.unread();
    return { content: [{ type: "text", text: JSON.stringify({ unread: n }) }] };
  });
}

function ensureAuth(cli: SheypoorClient): void {
  if (!cli.isAuthenticated) {
    throw new Error("Not authenticated. Call login_start then login_complete.");
  }
}
