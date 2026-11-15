import assert from "node:assert/strict";
import test from "node:test";
import Product from "../models/Product.js";
import StorefrontSettings from "../models/StorefrontSettings.js";
import { DEFAULT_STOREFRONT_SETTINGS } from "../utils/storefrontDefaults.js";
import { normalizeProductPayload, toProductResponse } from "../routes/products.js";

test("product impression counts default to zero and cannot be set in product payloads", () => {
  const product = new Product({
    title: "Test product",
    slug: "test-product",
    sku: "TEST-001",
    price: 100,
  });

  assert.equal(product.impressionCount, 0);
  assert.equal(normalizeProductPayload({ title: "Test", impressionCount: 123 }).impressionCount, undefined);
});

test("impression tracking is disabled by default for new and existing storefronts", () => {
  const settings = new StorefrontSettings();

  assert.equal(settings.impressionTrackingEnabled, false);
  assert.equal(DEFAULT_STOREFRONT_SETTINGS.impressionTrackingEnabled, false);
});

test("product responses expose impression counts only when tracking is enabled", () => {
  const product = {
    toObject: () => ({ stock: 1, price: 100, impressionCount: 7 }),
  };

  assert.equal(toProductResponse(product).impressionCount, undefined);
  assert.equal(toProductResponse(product, true).impressionCount, 7);
});
