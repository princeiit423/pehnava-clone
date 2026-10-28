const CHECKOUT_ITEM_KEY = "kcs_checkout_item";

export function startCheckout(navigate, item) {
  sessionStorage.setItem(CHECKOUT_ITEM_KEY, JSON.stringify(item));
  navigate("/checkout");
}

export function readCheckoutItem() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CHECKOUT_ITEM_KEY) || "null");
    return value && typeof value.productId === "string" && Number.isInteger(value.quantity) ? value : null;
  } catch {
    return null;
  }
}

export function clearCheckoutItem() {
  sessionStorage.removeItem(CHECKOUT_ITEM_KEY);
}
