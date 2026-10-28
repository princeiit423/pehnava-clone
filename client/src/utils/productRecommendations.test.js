import { describe, expect, it } from "vitest";
import { getRelatedProduct } from "./productRecommendations.js";

const currentProduct = {
  _id: "current",
  categories: ["festive-wear"],
  type: "Stitched",
  fabric: "Cotton",
};

describe("getRelatedProduct", () => {
  it("chooses the strongest in-stock category match", () => {
    const sameType = { _id: "type-match", type: "Stitched", stock: 3 };
    const categoryMatch = { _id: "category-match", categories: ["festive-wear"], stock: 1 };
    const bestMatch = {
      _id: "best-match",
      categories: ["festive-wear"],
      type: "Stitched",
      fabric: "Cotton",
      stock: 2,
    };

    expect(getRelatedProduct([sameType, categoryMatch, bestMatch], currentProduct)).toBe(bestMatch);
  });

  it("returns no suggestion when products are unrelated or unavailable", () => {
    const unrelated = { _id: "unrelated", categories: ["daily-wear"], stock: 5 };
    const soldOutMatch = { _id: "sold-out", categories: ["festive-wear"], soldOut: true, stock: 0 };

    expect(getRelatedProduct([unrelated, soldOutMatch], currentProduct)).toBeNull();
  });

  it("never recommends the product currently being viewed", () => {
    const sameProduct = { ...currentProduct, stock: 5 };

    expect(getRelatedProduct([sameProduct], currentProduct)).toBeNull();
  });
});
