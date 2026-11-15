export const COD_FEE_RATE = 0.04;
export const RETURN_REQUEST_WINDOW_DAYS = 7;

export function normalizeShippingAddress(shippingAddress) {
  const requiredFields = ["name", "phone", "address", "city", "state", "pinCode"];
  if (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
    throw Object.assign(new Error("A valid shipping address is required"), { status: 400 });
  }

  const address = Object.fromEntries(
    requiredFields.map((field) => [field, String(shippingAddress[field] || "").trim()])
  );
  address.email = String(shippingAddress.email || "").trim().toLowerCase();
  if (
    requiredFields.some((field) => !address[field]) ||
    address.name.length > 100 ||
    address.address.length > 250 ||
    address.city.length > 80 ||
    address.state.length > 80 ||
    !/^[6-9]\d{9}$/.test(address.phone.replace(/\D/g, "")) ||
    !/^\d{6}$/.test(address.pinCode)
  ) {
    throw Object.assign(new Error("Enter a complete shipping address and valid 10-digit Indian phone number"), { status: 400 });
  }
  if (address.email && (address.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email))) {
    throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
  }
  return address;
}

export function calculateItemSubtotal(items) {
  return Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
}

export function calculateCodFee(itemSubtotal) {
  return Number((itemSubtotal * COD_FEE_RATE).toFixed(2));
}

export function getDeliveredAt(order) {
  return order.deliveredAt || (order.status === "delivered" ? order.updatedAt : null);
}

export function isReturnRequestWithinWindow(order, now = Date.now()) {
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt || order.status !== "delivered") return false;
  const deliveryTime = new Date(deliveredAt).getTime();
  return Number.isFinite(deliveryTime)
    && now >= deliveryTime
    && now <= deliveryTime + RETURN_REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
