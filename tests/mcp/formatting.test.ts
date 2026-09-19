import { describe, it, expect } from "vitest";
import { compactListing, compactDetail, asciiJson } from "../../src/mcp/formatting.js";
import type { Listing, ListingDetail } from "../../src/client/models.js";

describe("formatting", () => {
  const listing: Listing = {
    id: "1",
    type: "normal",
    title: "iPhone 15",
    url: "https://sheypoor.com/foo-1.html",
    price: [{ amount: "۲۵۰,۰۰۰", currency: "تومان", label: "۲۵۰ هزار تومان" }],
    location: "تهران",
    categoryId: 1,
    imageCount: 3,
    videoCount: 0,
    telephone: "09123456789",
    attributes: [],
    raw: {},
  };

  it("compactListing normalizes price", () => {
    const c = compactListing(listing);
    expect(c.price.amount).toBe(250000);
    expect(c.price.currency).toBe("IRT");
    expect(c.title).toBe("iPhone 15");
  });

  it("compactDetail strips html and truncates", () => {
    const detail: ListingDetail = {
      id: "1",
      title: "T",
      url: "u",
      description: "<p>Hello<br/>World</p>",
      price: [],
      images: [],
      seller: { name: "S", url: "u", rates: { score: 4.5, count: 10 } },
      phone: "09x",
      isPhoneVerified: true,
      isShopProfile: false,
    };
    const c = compactDetail(detail);
    expect(c.description).toBe("Hello\nWorld");
    expect(c.seller?.rating).toBe(4.5);
    expect(c.seller?.review_count).toBe(10);
  });

  it("asciiJson replaces Persian/Arabic digits", () => {
    expect(asciiJson({ a: "۰" })).toBe('{\n  "a": "0"\n}');
  });
});
