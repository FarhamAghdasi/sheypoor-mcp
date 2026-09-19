import { describe, it, expect } from "vitest";
import {
  parseRscPayload,
  balancedJson,
  parseJsonLd,
  extractListingFromRsc,
} from "../../src/client/rsc.js";

describe("rsc parser", () => {
  it("parseRscPayload concatenates chunks", () => {
    const html = `self.__next_f.push([1,"{\\"a\\":1}"]);self.__next_f.push([1,"{\\"b\\":2}"]);`;
    expect(parseRscPayload(html)).toBe('{"a":1}{"b":2}');
  });

  it("parseRscPayload does not skip bad chunks (passes raw)", () => {
    const html = `self.__next_f.push([1,"not-json"]);self.__next_f.push([1,"{\\"ok\\":true}"]);`;
    expect(parseRscPayload(html)).toBe('not-json{"ok":true}');
  });

  it("balancedJson parses object", () => {
    expect(balancedJson('{"a":1,"b":[1,2]}', 0)).toEqual({ a: 1, b: [1, 2] });
  });

  it("balancedJson throws on unbalanced", () => {
    expect(() => balancedJson("{", 0)).toThrow("Unbalanced JSON");
  });

  it("parseJsonLd extracts blocks", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X"}</script>`;
    expect(parseJsonLd(html)).toEqual([{ "@type": "Product", name: "X" }]);
  });

  it("parseJsonLd skips malformed blocks", () => {
    const html = `<script type="application/ld+json">{bad</script><script type="application/ld+json">{"ok":1}</script>`;
    expect(parseJsonLd(html)).toEqual([{ ok: 1 }]);
  });

  it("extractListingFromRsc returns null when missing marker", () => {
    expect(extractListingFromRsc("<html>no data</html>")).toBeNull();
  });

  it("extractListingFromRsc extracts data blob after marker", () => {
    const payload = JSON.stringify({
      queryKey: ["LOAD_LISTING", "1"],
      data: { id: "1", title: "T" },
    });
    const html = `self.__next_f.push([1,"${payload.replace(/"/g, '\\"')}"]);`;
    expect(extractListingFromRsc(html)).toEqual({ id: "1", title: "T" });
  });
});
