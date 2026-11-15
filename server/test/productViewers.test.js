import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import ProductViewerPresence from "../models/ProductViewerPresence.js";
import {
  getProductViewerExpiry,
  hashProductViewerId,
  normalizeProductViewerId,
  PRODUCT_VIEWER_LEASE_MS,
} from "../utils/productViewers.js";

test("validates viewer session identifiers and stores only a stable hash", () => {
  const viewerId = "viewer-session_123456";

  assert.equal(normalizeProductViewerId(viewerId), viewerId);
  assert.throws(() => normalizeProductViewerId("too-short"), (error) => error.status === 400);
  assert.throws(() => normalizeProductViewerId("x".repeat(101)), (error) => error.status === 400);
  assert.equal(hashProductViewerId(viewerId), hashProductViewerId(viewerId));
  assert.equal(hashProductViewerId(viewerId).includes(viewerId), false);
});

test("expires viewer presence leases after the active window", () => {
  const now = 1_800_000_000_000;

  assert.equal(PRODUCT_VIEWER_LEASE_MS, 60_000);
  assert.equal(getProductViewerExpiry(now).getTime(), now + 60_000);
});

test("validates viewer presence records and configures unique and TTL indexes", () => {
  const presence = new ProductViewerPresence({
    productId: new mongoose.Types.ObjectId(),
    viewerHash: "a".repeat(64),
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + PRODUCT_VIEWER_LEASE_MS),
  });
  const indexes = ProductViewerPresence.schema.indexes();

  assert.equal(presence.validateSync(), undefined);
  assert.ok(indexes.some(([keys, options]) => keys.productId === 1 && keys.viewerHash === 1 && options.unique === true));
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});
