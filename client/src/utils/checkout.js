const CHECKOUT_ITEM_KEY = "kcs_checkout_item";
const CHECKOUT_ITEMS_KEY = "kcs_checkout_items";
const CHECKOUT_FROM_CART_KEY = "kcs_checkout_from_cart";
const CHECKOUT_REQUEST_KEY = "kcs_checkout_request_id";

export function startCheckout(navigate, itemOrItems, { fromCart = false } = {}) {
  const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
  sessionStorage.setItem(CHECKOUT_ITEMS_KEY, JSON.stringify(items));
  sessionStorage.removeItem(CHECKOUT_ITEM_KEY);
  sessionStorage.setItem(CHECKOUT_FROM_CART_KEY, fromCart ? "true" : "false");
  sessionStorage.setItem(CHECKOUT_REQUEST_KEY, createCheckoutRequestId());
  navigate("/checkout");
}

export function readCheckoutItems() {
  try {
    const savedItems = JSON.parse(sessionStorage.getItem(CHECKOUT_ITEMS_KEY) || "null");
    const items = savedItems || [JSON.parse(sessionStorage.getItem(CHECKOUT_ITEM_KEY) || "null")];
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item
      && typeof item.productId === "string"
      && Number.isInteger(item.quantity)
      && item.quantity >= 1
      && item.quantity <= 20
    );
  } catch {
    return [];
  }
}

export function hasCheckoutItems() {
  return readCheckoutItems().length > 0;
}

export function isCartCheckout() {
  return sessionStorage.getItem(CHECKOUT_FROM_CART_KEY) === "true";
}

export function readCheckoutRequestId() {
  let requestId = sessionStorage.getItem(CHECKOUT_REQUEST_KEY);
  if (!requestId) {
    requestId = createCheckoutRequestId();
    sessionStorage.setItem(CHECKOUT_REQUEST_KEY, requestId);
  }
  return requestId;
}

function createCheckoutRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clearCheckoutItem() {
  sessionStorage.removeItem(CHECKOUT_ITEM_KEY);
  sessionStorage.removeItem(CHECKOUT_ITEMS_KEY);
  sessionStorage.removeItem(CHECKOUT_FROM_CART_KEY);
  sessionStorage.removeItem(CHECKOUT_REQUEST_KEY);
}
