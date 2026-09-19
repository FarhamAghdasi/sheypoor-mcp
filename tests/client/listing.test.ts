import { describe, it, expect } from "vitest";
import {
  toAsciiDigits,
  toPersianDigits,
  normalizePrice,
  fullSizeImage,
  extractListingId,
} from "../../src/client/listing.js";

describe("listing helpers", () => {
  describe("toAsciiDigits", () => {
    it("passes through ASCII digits", () => {
      expect(toAsciiDigits("123")).toBe("123");
    });

    it("converts Persian digits", () => {
      expect(toAsciiDigits("۱۲۳")).toBe("123");
    });

    it("converts Arabic digits", () => {
      expect(toAsciiDigits("١٢٣")).toBe("123");
    });

    it("mixes", () => {
      expect(toAsciiDigits("آیفون ۱xl")).toBe("آیفون 1xl");
    });
  });

  describe("toPersianDigits", () => {
    it("converts ASCII to Persian", () => {
      expect(toPersianDigits("123")).toBe("۱۲۳");
    });
  });

  describe("normalizePrice", () => {
    it("normalizes Toman price", () => {
      const p = normalizePrice({ amount: "۲۵۰,۰۰۰", currency: "تومان" });
      expect(p.amount).toBe(250000);
      expect(p.currency).toBe("IRT");
      expect(p.negotiable).toBe(false);
    });

    it("normalizes Rial price", () => {
      const p = normalizePrice({ amount: 1000, currency: "ریال" });
      expect(p.amount).toBe(1000);
      expect(p.currency).toBe("IRR");
    });

    it("marks non-numeric as negotiable", () => {
      const p = normalizePrice({ amount: "توافقی", currency: "تومان" });
      expect(p.amount).toBeNull();
      expect(p.currency).toBeNull();
      expect(p.negotiable).toBe(true);
    });

    it("handles null amount", () => {
      const p = normalizePrice({ amount: null, currency: "تومان" });
      expect(p.amount).toBeNull();
      expect(p.negotiable).toBe(true);
    });
  });

  describe("fullSizeImage", () => {
    it("rewrites resized CDN URL", () => {
      expect(fullSizeImage("https://cdn.sheypoor.com/300x200_Sw/abc.jpg")).toBe(
        "https://cdn.sheypoor.com/1500x1125_Sw/abc.jpg",
      );
    });

    it("leaves unknown URLs alone", () => {
      const url = "https://example.com/photo.jpg";
      expect(fullSizeImage(url)).toBe(url);
    });
  });

  describe("extractListingId", () => {
    it("extracts from canonical URL", () => {
      expect(extractListingId("https://sheypoor.com/foo-bar-123456.html")).toBe("123456");
    });

    it("returns null when no ID", () => {
      expect(extractListingId("https://sheypoor.com/foo-bar")).toBeNull();
    });

    it("decodes URL-encoded path", () => {
      expect(extractListingId("https://sheypoor.com/%D9%81%D9%88-123.html")).toBe("123");
    });
  });
});
