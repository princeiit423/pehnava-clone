import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCheckoutItem,
  hasCheckoutItems,
  isCartCheckout,
  readCheckoutItems,
  startCheckout,
} from "./checkout.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe("checkout cart handoff", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores multiple cart items for checkout and identifies cart-origin orders", () => {
    vi.stubGlobal("sessionStorage", createStorage());
    const navigate = vi.fn();
    const items = [
      { productId: "product-1", quantity: 2, size: "M", color: "Blue" },
      { productId: "product-2", quantity: 1, size: "L", color: "Black" },
    ];

    startCheckout(navigate, items, { fromCart: true });

    expect(navigate).toHaveBeenCalledWith("/checkout");
    expect(readCheckoutItems()).toEqual(items);
    expect(hasCheckoutItems()).toBe(true);
    expect(isCartCheckout()).toBe(true);
  });

  it("continues to read checkout items saved by the earlier single-item flow", () => {
    const storage = createStorage();
    storage.setItem("kcs_checkout_item", JSON.stringify({ productId: "product-1", quantity: 1 }));
    vi.stubGlobal("sessionStorage", storage);

    expect(readCheckoutItems()).toEqual([{ productId: "product-1", quantity: 1 }]);
    expect(hasCheckoutItems()).toBe(true);
  });

  it("clears checkout state after order completion", () => {
    vi.stubGlobal("sessionStorage", createStorage());
    startCheckout(vi.fn(), { productId: "product-1", quantity: 1 }, { fromCart: true });

    clearCheckoutItem();

    expect(readCheckoutItems()).toEqual([]);
    expect(hasCheckoutItems()).toBe(false);
    expect(isCartCheckout()).toBe(false);
  });
});
