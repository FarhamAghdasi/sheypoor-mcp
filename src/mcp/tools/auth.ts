import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SheypoorClient } from "../../client/index.js";
import { SheypoorRateLimitError } from "../../client/errors.js";

interface PendingStore {
  [sessionId: string]: { verifyToken: string; phone: string; expiresAt: number };
}

export function registerAuthTools(server: McpServer, cli: SheypoorClient) {
  const pending: PendingStore = {};

  server.tool(
    "login_start",
    "Start Sheypoor login. Sends an SMS code to the given Iranian mobile number. " +
      "Returns a sessionId you must pass to login_complete along with the code the user receives.",
    {
      phone: z.string().regex(/^09\d{9}$/, "Iranian mobile number, e.g. 09000000000"),
    },
    async (args) => {
      try {
        const started = await cli.auth.start(args.phone);
        const sessionId = crypto.randomUUID();
        pending[sessionId] = {
          verifyToken: started.verifyToken,
          phone: started.phone,
          expiresAt: started.expiresAt,
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sessionId,
                  phone: args.phone,
                  expiresInSeconds: Math.round((started.expiresAt - Date.now()) / 1000),
                  next: "Ask the user for the SMS code, then call login_complete.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        const isRateLimit = err instanceof SheypoorRateLimitError;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: isRateLimit ? "rate_limited" : "login_start_failed",
                  message: err.message ?? String(err),
                  retryAfter: isRateLimit ? err.retryAfter : undefined,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "login_complete",
    "Complete Sheypoor login with the SMS code. Persists cookies for future sessions.",
    {
      sessionId: z.string(),
      code: z.string().min(1).describe("SMS code received on the phone"),
    },
    async (args) => {
      const entry = pending[args.sessionId];
      if (!entry) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: "unknown sessionId" }, null, 2) },
          ],
          isError: true,
        };
      }
      if (Date.now() > entry.expiresAt) {
        delete pending[args.sessionId];
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "session expired" }, null, 2) }],
          isError: true,
        };
      }
      const tokens = await cli.auth.complete(
        { verifyToken: entry.verifyToken, phone: entry.phone, expiresAt: entry.expiresAt },
        args.code,
      );
      delete pending[args.sessionId];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                userId: tokens.userId,
                userName: tokens.userName,
                cookiesSaved: true,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool("logout", "Log out of Sheypoor: clear cookies and tokens.", {}, async () => {
    cli.logout();
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  });

  server.tool("whoami", "Return the authenticated user's profile.", {}, async () => {
    if (!cli.isAuthenticated) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "not authenticated" }, null, 2) }],
        isError: true,
      };
    }
    const profile = await cli.account.profile();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              userId: profile.id,
              name: profile.attributes.userName,
              phone: profile.attributes.userPhone,
            },
            null,
            2,
          ),
        },
      ],
    };
  });
}
