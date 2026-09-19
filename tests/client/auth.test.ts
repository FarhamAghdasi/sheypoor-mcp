import { describe, it, expect, vi } from "vitest";
import { AuthManager } from "../../src/client/auth.js";
import type { HttpClient } from "../../src/client/http.js";

function createHttpClient(cookies: Record<string, string> = {}): HttpClient {
  return {
    cookies: {
      get: (k: string) => cookies[k],
      set: vi.fn(),
      saveCookies: vi.fn(),
      destroy: vi.fn(),
      toHeader: () => "",
      load: vi.fn(),
    },
    clearCookies: vi.fn(),
  } as unknown as HttpClient;
}

describe("AuthManager", () => {
  it("restores tokens from cookies with Bearer prefix", () => {
    const at = "Bearer abc.def.ghi";
    const http = createHttpClient({ access_token: at, refresh_token: "Bearer refresh123" });
    const auth = new AuthManager(http);
    const tokens = auth.getTokens();
    expect(tokens?.accessToken).toBe("abc.def.ghi");
    expect(tokens?.refreshToken).toBe("refresh123");
  });

  it("isAuthenticated is false when no tokens", () => {
    const http = createHttpClient();
    const auth = new AuthManager(http);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it("logout clears tokens and cookies", () => {
    const http = createHttpClient({ access_token: "Bearer a", refresh_token: "Bearer r" });
    const auth = new AuthManager(http);
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);
    expect(http.clearCookies).toHaveBeenCalled();
  });
});
