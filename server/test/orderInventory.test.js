import assert from "node:assert/strict";
import test from "node:test";
import Product from "../models/Product.js";
import { restoreOrderStock } from "../utils/orderInventory.js";

test("rolls back earlier inventory updates if a later order item cannot be restored", async () => {
  const originalFindById = Product.findById;
  const originalUpdateOne = Product.updateOne;
  const productId = "507f1f77bcf86cd799439011";
  const missingProductId = "507f1f77bcf86cd799439012";
  const product = {
    _id: productId,
    stock: 3,
    soldOut: true,
    variantStock: [],
    colors: [],
  };
  const products = new Map([[productId, product]]);

  Product.findById = (id) => ({
    select: () => Promise.resolve(products.get(String(id))),
  });
  Product.updateOne = async (filter, update) => {
    const target = products.get(String(filter._id));
    if (!target) return { modifiedCount: 0 };
    for (const [field, amount] of Object.entries(update.$inc || {})) {
      target[field] += amount;
    }
    Object.assign(target, update.$set || {});
    return { modifiedCount: 1 };
  };

  try {
    const order = {
      items: [
        { productId, title: "Available product", quantity: 2 },
        { productId: missingProductId, title: "Deleted product", quantity: 1 },
      ],
      save: async () => {},
    };

    await assert.rejects(
      restoreOrderStock(order),
      /no longer exists/
    );
    assert.equal(product.stock, 3);
    assert.equal(product.soldOut, true);
    assert.equal(order.stockRestoredAt, undefined);
  } finally {
    Product.findById = originalFindById;
    Product.updateOne = originalUpdateOne;
  }
});
