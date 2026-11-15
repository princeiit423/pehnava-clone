import assert from "node:assert/strict";
import test from "node:test";
import Coupon from "../models/Coupon.js";
import {
  calculateCouponDiscount,
  normalizeCouponCode,
  normalizeCouponPayload,
} from "../utils/coupons.js";

const dates = {
  startsAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
};

function coupon(overrides = {}) {
  return {
    code: "SAVE10",
    discountType: "percentage",
    discountValue: 10,
    minimumOrderAmount: 0,
    maximumDiscount: null,
    active: true,
    ...dates,
    ...overrides,
  };
}

test("normalizes coupon codes and rejects malformed codes", () => {
  assert.equal(normalizeCouponCode(" save-10 "), "SAVE-10");
  assert.throws(() => normalizeCouponCode("no"), /3–32/);
  assert.throws(() => normalizeCouponCode("BAD CODE"), /3–32/);
});

test("normalizes valid coupon settings and rejects invalid validity and discounts", () => {
  const normalized = normalizeCouponPayload({
    ...coupon(),
    maximumDiscount: 50,
  });
  assert.equal(normalized.code, "SAVE10");
  assert.equal(normalized.maximumDiscount, 50);

  assert.throws(() => normalizeCouponPayload({
    ...coupon(),
    startsAt: dates.expiresAt,
  }), /end must be after the start/);
  assert.throws(() => normalizeCouponPayload({
    ...coupon(),
    discountValue: 101,
  }), /0.01% to 100%/);
  assert.throws(() => normalizeCouponPayload({
    ...coupon(),
    discountType: "fixed",
    maximumDiscount: 25,
  }), /only be set for percentage/);
});

test("calculates percentage and fixed discounts with caps and subtotal bounds", () => {
  assert.equal(calculateCouponDiscount(coupon(), 500, new Date("2026-06-01")), 50);
  assert.equal(calculateCouponDiscount(coupon({ maximumDiscount: 30 }), 500, new Date("2026-06-01")), 30);
  assert.equal(calculateCouponDiscount(coupon({
    discountType: "fixed",
    discountValue: 499,
  }), 500, new Date("2026-06-01")), 499);
  assert.throws(() => calculateCouponDiscount(coupon({
    discountType: "fixed",
    discountValue: 500,
  }), 500, new Date("2026-06-01")), /leave at least Rs. 1/);
});

test("rejects inactive, out-of-window, and below-minimum coupons", () => {
  assert.throws(
    () => calculateCouponDiscount(coupon({ active: false }), 500, new Date("2026-06-01")),
    /invalid or inactive/
  );
  assert.throws(
    () => calculateCouponDiscount(coupon(), 500, new Date("2025-12-31")),
    /not currently valid/
  );
  assert.throws(
    () => calculateCouponDiscount(coupon({ minimumOrderAmount: 600 }), 500, new Date("2026-06-01")),
    /minimum order/
  );
});

test("validates persisted coupon records", () => {
  const record = new Coupon({
    ...normalizeCouponPayload({
      ...coupon(),
      maximumDiscount: "",
    }),
  });
  assert.equal(record.validateSync(), undefined);
});
