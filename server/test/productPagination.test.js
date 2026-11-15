import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeProductCursor,
  encodeProductCursor,
  parseProductPageSize,
} from "../utils/productPagination.js";

const product = {
  _id: "64b000000000000000000001",
  createdAt: new Date("2025-01-02T03:04:05.000Z"),
};

test("product page sizes are bounded and reject invalid values", () => {
  assert.equal(parseProductPageSize("24"), 24);
  assert.equal(parseProductPageSize("500"), 50);
  for (const value of ["0", "-1", "1.5", "nope", ["24"]]) {
    assert.throws(() => parseProductPageSize(value));
  }
});

test("product cursors round-trip their stable sort position", () => {
  assert.deepEqual(decodeProductCursor(encodeProductCursor(product)), {
    createdAt: product.createdAt,
    id: product._id,
  });
});

test("product cursors reject malformed or oversized input", () => {
  for (const value of ["not-a-cursor", Buffer.from('{"id":"bad"}').toString("base64url"), "a".repeat(257)]) {
    assert.throws(() => decodeProductCursor(value));
  }
});
