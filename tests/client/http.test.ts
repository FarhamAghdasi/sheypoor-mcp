import { describe, it, expect, vi } from "vitest";
import { HttpClient } from "../../src/client/http.js";

describe("HttpClient", () => {
  it("request retries on 5xx and eventually succeeds", async () => {
    let calls = 0;
    const mockFetch = async (): Promise<Response> => {
      calls++;
      if (calls < 3) {
        return { status: 502, headers: new Map([["content-type", "application/json"]]), json: async () => ({}), text: async () => "", ok: false } as any;
      }
      return { status: 200, headers: new Map([["content-type", "application/json"]]), json: async () => ({ ok: true }), text: async () => "{}", ok: true } as any;
    };
    vi.stubGlobal("fetch", mockFetch);
    const client = new HttpClient({ cookieFile: undefined, maxRetries: 3, minDelayMs: 0, maxDelayMs: 0, rateCapacity: 100, rateRefillPerSec: 100 });
    const res = await (client as any).request("https://example.com/a", { method: "GET" });
    expect(res).toEqual({ ok: true });
    expect(calls).toBe(3);
    vi.unstubAllGlobals();
  });

  it("request throws on 404 without retry", async () => {
    let calls = 0;
    const mockFetch = async (): Promise<Response> => {
      calls++;
      return { status: 404, headers: new Map(), json: async () => ({}), text: async () => "", ok: false } as any;
    };
    vi.stubGlobal("fetch", mockFetch);
    const client = new HttpClient({ cookieFile: undefined, maxRetries: 1, minDelayMs: 0, maxDelayMs: 0, rateCapacity: 100, rateRefillPerSec: 100 });
    await expect((client as any).request("https://example.com/a")).rejects.toThrow("404 Not Found");
    expect(calls).toBe(1);
    vi.unstubAllGlobals();
  });
});
