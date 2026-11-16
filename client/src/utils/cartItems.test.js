import { describe, expect, it } from "vitest";
import { changeCartItemSize } from "./cartItems.js";

const small = {
  productId: "shirt",
  color: "Black",
  size: "S",
  quantity: 2,
  key: "shirt::Black::S",
};

describe("changeCartItemSize", () => {
  it("updates the selected size and cart key", () => {
    expect(changeCartItemSize([small], small.key, "M")).toEqual([{
      ...small,
      size: "M",
      key: "shirt::Black::M",
    }]);
  });

  it("merges into an existing size line", () => {
    const medium = { ...small, size: "M", quantity: 1, key: "shirt::Black::M" };
    expect(changeCartItemSize([small, medium], small.key, "M")).toEqual([{
      ...medium,
      quantity: 3,
    }]);
  });

  it("rejects a size change that would exceed the per-option quantity limit", () => {
    const medium = { ...small, size: "M", quantity: 19, key: "shirt::Black::M" };
    expect(() => changeCartItemSize([small, medium], small.key, "M"))
      .toThrow("You can add up to 20 of this product option.");
  });
});
