import { describe, expect, it } from "vitest";
import {
  getProductGalleryImages,
  parseProductImageUrls,
} from "./productImages.js";

describe("parseProductImageUrls", () => {
  it("accepts comma-separated and one-link-per-line URLs", () => {
    expect(parseProductImageUrls(" https://shop.test/one.jpg,\nhttps://shop.test/two.jpg \r\nhttps://shop.test/three.jpg "))
      .toEqual([
        "https://shop.test/one.jpg",
        "https://shop.test/two.jpg",
        "https://shop.test/three.jpg",
      ]);
  });

  it("removes blank entries and duplicates", () => {
    expect(parseProductImageUrls("https://shop.test/one.jpg,,\nhttps://shop.test/one.jpg,"))
      .toEqual(["https://shop.test/one.jpg"]);
  });
});

describe("getProductGalleryImages", () => {
  it("shows color-specific photos and the shared product gallery", () => {
    expect(getProductGalleryImages({
      images: ["/shared/front.jpg", "/shared/back.jpg"],
      colors: [
        { name: "Black", images: ["/black/front.jpg", "/shared/front.jpg"] },
      ],
    }, "Black")).toEqual([
      "/black/front.jpg",
      "/shared/front.jpg",
      "/shared/back.jpg",
    ]);
  });

  it("uses the shared gallery when the selected color has no photos", () => {
    expect(getProductGalleryImages({
      images: ["/shared/front.jpg", "/shared/back.jpg"],
      colors: [{ name: "Navy", images: [] }],
    }, "Navy")).toEqual(["/shared/front.jpg", "/shared/back.jpg"]);
  });
});
