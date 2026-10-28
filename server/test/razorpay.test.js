import test from "node:test";
import assert from "node:assert/strict";
import { asyncHandler, requestRazorpay } from "../utils/razorpay.js";
import { createPaymentItemSnapshot } from "../utils/paymentItems.js";
import PaymentIntent from "../models/PaymentIntent.js";

const originalFetch = globalThis.fetch;
const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

test.beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = "test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = originalKeyId;
  if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
});

test("sends authenticated JSON requests to Razorpay and parses the response", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.razorpay.com/v1/orders");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from("test_key:test_secret").toString("base64")}`);
    assert.deepEqual(JSON.parse(options.body), { amount: 12000, currency: "INR" });
    return new Response(JSON.stringify({ id: "order_test", amount: 12000, currency: "INR" }), { status: 200 });
  };

  const response = await requestRazorpay("/orders", { method: "POST", body: { amount: 12000, currency: "INR" } });
  assert.equal(response.ok, true);
  assert.equal(response.data.id, "order_test");
});

test("returns provider error status and payload without throwing", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR" } }), { status: 400 });
  const response = await requestRazorpay("/orders");
  assert.equal(response.ok, false);
  assert.equal(response.status, 400);
  assert.equal(response.data.error.code, "BAD_REQUEST_ERROR");
});

test("reports network failures for the route error handler", async () => {
  globalThis.fetch = async () => { throw new Error("network down"); };
  await assert.rejects(requestRazorpay("/orders"), /network down/);
});

test("forwards asynchronous route errors to Express", async () => {
  const expectedError = new Error("handler failed");
  let forwardedError;
  const handler = asyncHandler(async () => { throw expectedError; });
  handler({}, {}, (error) => { forwardedError = error; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(forwardedError, expectedError);
});

test("builds a valid payment item from the product catalog", () => {
  const item = createPaymentItemSnapshot(
    { _id: "product-id", title: "Catalog title", slug: "catalog-slug", price: 2000, discount: 10, images: ["image.jpg"] },
    { title: "Client title", size: "M", color: "Blue" },
    2,
    "M",
    "Blue"
  );

  assert.deepEqual(item, {
    productId: "product-id",
    slug: "catalog-slug",
    title: "Catalog title",
    image: "image.jpg",
    quantity: 2,
    price: 1800,
    size: "M",
    color: "Blue",
  });
});

test("uses the checkout title if an older catalog record has no title", () => {
  const item = createPaymentItemSnapshot(
    { _id: "product-id", price: 1500, images: [] },
    { title: "Product title from checkout" },
    1,
    "",
    ""
  );

  assert.equal(item.title, "Product title from checkout");
  assert.equal(item.slug, "product-id");
});

test("rejects payment items with no available title or valid catalog price", () => {
  assert.equal(createPaymentItemSnapshot({ _id: "product-id", price: 10 }, {}, 1, "", ""), null);
  assert.equal(createPaymentItemSnapshot({ _id: "product-id", title: "Product", price: NaN }, {}, 1, "", ""), null);
});

test("accepts and validates a recorded payment exit reason", () => {
  const intent = new PaymentIntent({
    customer: "507f1f77bcf86cd799439011",
    items: [{ productId: "product-id", slug: "dress", title: "Dress", quantity: 1, price: 1200 }],
    total: 1200,
    amountPaise: 120000,
    shippingAddress: { name: "Customer", phone: "7004281547", address: "Street", city: "City", state: "State", pinCode: "700001" },
    razorpayOrderId: "order_test",
    feedback: [{ outcome: "exited", reason: "changed_mind" }],
  });

  assert.equal(intent.validateSync(), undefined);
});

test("rejects unsupported payment feedback reasons", () => {
  const intent = new PaymentIntent({
    customer: "507f1f77bcf86cd799439011",
    items: [{ productId: "product-id", slug: "dress", title: "Dress", quantity: 1, price: 1200 }],
    total: 1200,
    amountPaise: 120000,
    shippingAddress: { name: "Customer", phone: "7004281547", address: "Street", city: "City", state: "State", pinCode: "700001" },
    razorpayOrderId: "order_test",
    feedback: [{ outcome: "exited", reason: "invalid_reason" }],
  });

  assert.equal(intent.validateSync().errors["feedback.0.reason"].kind, "enum");
});
