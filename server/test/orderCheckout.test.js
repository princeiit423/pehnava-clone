import assert from "node:assert/strict";
import test from "node:test";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  calculateCodFee,
  calculateItemSubtotal,
  isReturnRequestWithinWindow,
  normalizeShippingAddress,
} from "../utils/orderCheckout.js";
import {
  canCustomerCancelOrder,
  getCancellableOrderStatuses,
} from "../utils/orderCancellation.js";

const address = {
  name: "Test Customer",
  phone: "7004281547",
  email: "customer@example.com",
  address: "12 Example Road",
  city: "Bokaro",
  state: "Jharkhand",
  pinCode: "827001",
};

test("calculates COD handling fee on the rounded item subtotal", () => {
  const subtotal = calculateItemSubtotal([
    { price: 250.25, quantity: 2 },
    { price: 100, quantity: 1 },
  ]);
  assert.equal(subtotal, 600.5);
  assert.equal(calculateCodFee(subtotal), 24.02);
});

test("normalizes valid shipping addresses and rejects invalid addresses", () => {
  assert.deepEqual(normalizeShippingAddress({ ...address, name: "  Test Customer  " }), address);
  assert.throws(
    () => normalizeShippingAddress({ ...address, phone: "123" }),
    (error) => error.status === 400
  );
});

test("allows a return request through the seventh day after delivery only", () => {
  const deliveredAt = new Date("2026-10-01T10:00:00.000Z");
  const order = { status: "delivered", deliveredAt };
  const windowEnd = deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000;

  assert.equal(isReturnRequestWithinWindow(order, deliveredAt.getTime()), true);
  assert.equal(isReturnRequestWithinWindow(order, windowEnd), true);
  assert.equal(isReturnRequestWithinWindow(order, windowEnd + 1), false);
  assert.equal(isReturnRequestWithinWindow({ ...order, status: "shipped" }, deliveredAt.getTime()), false);
});

test("allows customer cancellation only before processing starts, including legacy statuses", () => {
  assert.equal(canCustomerCancelOrder("order_placed"), true);
  assert.equal(canCustomerCancelOrder("payment_confirmed"), true);
  assert.equal(canCustomerCancelOrder("pending"), true);
  assert.equal(canCustomerCancelOrder("paid"), true);
  assert.equal(canCustomerCancelOrder("processing_packed"), false);
  assert.equal(canCustomerCancelOrder("processing"), false);
  assert.equal(canCustomerCancelOrder("shipped"), false);
  assert.equal(canCustomerCancelOrder("cancelled_refund"), false);
  assert.deepEqual(getCancellableOrderStatuses(), [
    "order_placed",
    "payment_confirmed",
    "pending",
    "paid",
  ]);
});

test("defaults catalog products to COD-eligible and validates return-request records", () => {
  const product = new Product({ title: "Test", slug: "test", sku: "TEST-1", price: 100 });
  assert.equal(product.codEligible, true);

  const order = new Order({
    items: [{ productId: "product-id", slug: "test", title: "Test item", quantity: 1, price: 100 }],
    itemSubtotal: 100,
    codFee: 4,
    total: 104,
    paymentMethod: "cod",
    shippingAddress: address,
    returnRequest: { type: "return", reason: "Wrong size", status: "requested" },
  });
  assert.equal(order.validateSync(), undefined);
  assert.equal(order.returnRequest.status, "requested");
});
