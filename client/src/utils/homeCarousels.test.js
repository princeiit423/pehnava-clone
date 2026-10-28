// Runtime validation coverage for homepage carousel configuration and filtering.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_CAROUSELS,
  getHomeCarouselProducts,
  getOrderedHomeCarousels,
} from "./homeCarousels.js";

describe("homepage carousel sections", () => {
  it("orders visible sections and leaves hidden sections out", () => {
    const sections = [
      { id: "later", active: true, order: 2 },
      { id: "hidden", active: false, order: 0 },
      { id: "first", active: true, order: 1 },
    ];

    expect(getOrderedHomeCarousels(sections).map(({ id }) => id)).toEqual(["first", "later"]);
    expect(sections.map(({ id }) => id)).toEqual(["later", "hidden", "first"]);
  });

  it("keeps the established default homepage sections", () => {
    expect(getOrderedHomeCarousels().map(({ id }) => id)).toEqual(
      DEFAULT_HOME_CAROUSELS.map(({ id }) => id)
    );
  });

  it("filters by product category tag including the legacy unstitched slug", () => {
    const products = [
      { _id: "ready", categories: ["ready-to-wear"] },
      { _id: "unstitched", categories: ["unstitched-wear"] },
      { _id: "other", categories: ["daily-wear"] },
    ];

    expect(getHomeCarouselProducts(products, {
      id: "ready", source: "tag", productTag: "ready-to-wear",
    }).map(({ _id }) => _id)).toEqual(["ready"]);
    expect(getHomeCarouselProducts(products, {
      id: "unstitched", source: "tag", productTag: "Unstitched",
    }).map(({ _id }) => _id)).toEqual(["unstitched"]);
  });

  it("applies inclusive and exclusive price boundaries", () => {
    const products = [1699, 1700, 3000, 3001].map((price) => ({ price }));

    expect(getHomeCarouselProducts(products, {
      source: "price", minPrice: 1700, maxPrice: 3000,
    }).map(({ price }) => price)).toEqual([1700, 3000]);
    expect(getHomeCarouselProducts(products, {
      source: "price", minPrice: 3000, minExclusive: true,
    }).map(({ price }) => price)).toEqual([3001]);
  });
});
