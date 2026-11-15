export function normalizeCouponCode(value) {
  if (typeof value !== "string") {
    throw Object.assign(new Error("Enter a valid coupon code."), { status: 400 });
  }
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw Object.assign(new Error("Coupon codes must be 3–32 letters, numbers, hyphens, or underscores."), { status: 400 });
  }
  return code;
}

export function normalizeCouponPayload(payload) {
  const invalid = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("A valid coupon is required.");
  }

  const code = normalizeCouponCode(payload.code);
  const discountType = payload.discountType;
  const discountValue = Number(payload.discountValue);
  const minimumOrderAmount = Number(payload.minimumOrderAmount ?? 0);
  const maximumDiscount = payload.maximumDiscount === "" || payload.maximumDiscount == null
    ? null
    : Number(payload.maximumDiscount);
  const startsAt = new Date(payload.startsAt);
  const expiresAt = new Date(payload.expiresAt);

  if (!["percentage", "fixed"].includes(discountType)) {
    invalid("Choose a percentage or fixed-amount discount.");
  }
  if (!Number.isFinite(discountValue) || discountValue < 0.01 || (discountType === "percentage" && discountValue > 100)) {
    invalid(discountType === "percentage"
      ? "Percentage discounts must be from 0.01% to 100%."
      : "Fixed discounts must be at least Rs. 0.01.");
  }
  if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0 || minimumOrderAmount > 100000000) {
    invalid("Minimum order amount must be a valid non-negative amount.");
  }
  if (maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount < 0.01 || maximumDiscount > 100000000)) {
    invalid("Maximum discount must be a valid positive amount.");
  }
  if (discountType === "fixed" && maximumDiscount !== null) {
    invalid("A maximum discount can only be set for percentage coupons.");
  }
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt) {
    invalid("Set a valid coupon start and end time; the end must be after the start.");
  }
  if (typeof payload.active !== "boolean") {
    invalid("Choose whether the coupon is active.");
  }

  return {
    code,
    discountType,
    discountValue: Number(discountValue.toFixed(2)),
    minimumOrderAmount: Number(minimumOrderAmount.toFixed(2)),
    maximumDiscount: maximumDiscount === null ? null : Number(maximumDiscount.toFixed(2)),
    startsAt,
    expiresAt,
    active: payload.active,
  };
}

export function calculateCouponDiscount(coupon, itemSubtotal, now = new Date()) {
  if (!coupon || coupon.active !== true) {
    throw Object.assign(new Error("This coupon is invalid or inactive."), { status: 400 });
  }
  const currentTime = new Date(now).getTime();
  if (currentTime < new Date(coupon.startsAt).getTime() || currentTime > new Date(coupon.expiresAt).getTime()) {
    throw Object.assign(new Error("This coupon is not currently valid."), { status: 400 });
  }
  if (!Number.isFinite(itemSubtotal) || itemSubtotal <= 0) {
    throw Object.assign(new Error("This coupon cannot be applied to this order."), { status: 400 });
  }
  if (itemSubtotal < Number(coupon.minimumOrderAmount || 0)) {
    throw Object.assign(new Error(`This coupon requires a minimum order of Rs. ${Number(coupon.minimumOrderAmount).toLocaleString("en-IN")}.`), { status: 400 });
  }

  const rawDiscount = coupon.discountType === "percentage"
    ? itemSubtotal * Number(coupon.discountValue) / 100
    : Number(coupon.discountValue);
  const cappedDiscount = coupon.maximumDiscount == null
    ? rawDiscount
    : Math.min(rawDiscount, Number(coupon.maximumDiscount));
  const discountAmount = Number(Math.min(itemSubtotal, cappedDiscount).toFixed(2));
  if (discountAmount <= 0) {
    throw Object.assign(new Error("This coupon cannot be applied to this order."), { status: 400 });
  }
  if (itemSubtotal - discountAmount < 1) {
    throw Object.assign(new Error("The coupon must leave at least Rs. 1 of the item subtotal to complete checkout."), { status: 400 });
  }
  return discountAmount;
}
