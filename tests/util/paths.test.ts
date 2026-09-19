import { describe, it, expect } from "vitest";
import { getAppPaths, defaultCookieFile, defaultCacheFile } from "../../src/util/paths.js";

describe("paths", () => {
  it("linux paths use XDG or ~/.config", () => {
    const p = getAppPaths();
    expect(p.config).toContain("sheypoor-mcp");
    expect(p.cache).toContain("sheypoor-mcp");
    expect(p.data).toContain("sheypoor-mcp");
  });

  it("defaultCookieFile is under config dir", () => {
    expect(defaultCookieFile()).toContain("cookies.json");
  });

  it("defaultCacheFile is under cache dir", () => {
    expect(defaultCacheFile()).toContain("cache.json");
  });
});
