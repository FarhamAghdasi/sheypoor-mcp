import { describe, it, expect, beforeEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CookieJar } from "../../src/client/cookies.js";
import { MemoryCookieStorage } from "../../src/client/cookie-storage.js";
import { FileCookieStorage } from "../../src/client/cookie-storage.js";

function tmpFile(name: string): string {
  return join(tmpdir(), `sheypoor-test-${name}.json`);
}

describe("CookieJar", () => {
  let jar: CookieJar;

  beforeEach(() => {
    jar = new CookieJar(new MemoryCookieStorage());
  });

  it("sets and gets a cookie", () => {
    jar.set("s", "v", undefined);
    expect(jar.get("s")).toBe("v");
  });

  it("returns undefined for missing cookie", () => {
    expect(jar.get("x")).toBeUndefined();
  });

  it("has reports presence", () => {
    jar.set("a", "1");
    expect(jar.has("a")).toBe(true);
    expect(jar.has("b")).toBe(false);
  });

  it("deletes a cookie", () => {
    jar.set("a", "1");
    jar.delete("a");
    expect(jar.has("a")).toBe(false);
  });

  it("clears all cookies", () => {
    jar.set("a", "1");
    jar.set("b", "2");
    jar.clear();
    expect(jar.get("a")).toBeUndefined();
    expect(jar.get("b")).toBeUndefined();
  });

  it("toHeader joins non-expired cookies", () => {
    jar.set("a", "1");
    jar.set("b", "2");
    expect(jar.toHeader()).toBe("a=1; b=2");
  });

  it("skips expired cookies in toHeader", () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    jar.set("a", "1", expired);
    jar.set("b", "2");
    expect(jar.toHeader()).toBe("b=2");
  });

  it("toObject returns all values including expired", () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    jar.set("a", "1", expired);
    jar.set("b", "2");
    expect(jar.toObject()).toEqual({ a: "1", b: "2" });
  });

  it("absorbSetCookie parses name/value and max-age", () => {
    jar.absorbSetCookie("token=abc; Max-Age=3600; Path=/");
    expect(jar.get("token")).toBe("abc");
  });

  it("absorbSetCookie parses expires", () => {
    const future = new Date(Date.now() + 10000).toUTCString();
    jar.absorbSetCookie(`s=v; Expires=${future}`);
    expect(jar.get("s")).toBe("v");
  });

  it("absorbSetCookie ignores expired max-age", () => {
    jar.absorbSetCookie("s=v; Max-Age=-1");
    expect(jar.get("s")).toBeUndefined();
  });

  it("save/load round-trips via file", () => {
    const tmp = tmpFile("cookies");
    const explicit = new CookieJar(new FileCookieStorage(tmp));
    explicit.set("x", "y");
    explicit.save();
    const loaded = new CookieJar(new FileCookieStorage(tmp));
    expect(loaded.get("x")).toBe("y");
  });

  it("destroy removes file and clears memory", () => {
    const tmp = tmpFile("cookies-destroy");
    const j = new CookieJar(new FileCookieStorage(tmp));
    j.set("a", "1");
    j.save();
    j.destroy();
    expect(j.get("a")).toBeUndefined();
    expect((j as any).path).toBe(tmp);
  });
});
