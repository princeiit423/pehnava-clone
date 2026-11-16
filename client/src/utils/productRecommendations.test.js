import { describe, expect, it } from "vitest";
import { getRecommendedProducts, getRelatedProduct } from "./productRecommendations.js";

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

describe("getRecommendedProducts", () => {
  it("ranks in-stock products related to any cart product and excludes cart products", () => {
    const secondCartProduct = { _id: "cart-2", categories: ["daily-wear"], type: "Shirt" };
    const related = { _id: "related", categories: ["daily-wear"], type: "Shirt", stock: 2 };
    const unrelated = { _id: "unrelated", categories: ["other"], stock: 3 };
    const unavailable = { _id: "sold-out", categories: ["daily-wear"], soldOut: true, stock: 0 };

    expect(getRecommendedProducts([
      unrelated,
      unavailable,
      related,
      { ...currentProduct, stock: 5 },
    ], [currentProduct, secondCartProduct], 2)).toEqual([related, unrelated]);
  });

  it("returns no recommendations without cart products", () => {
    expect(getRecommendedProducts([{ _id: "product", stock: 1 }], [])).toEqual([]);
  });
});
