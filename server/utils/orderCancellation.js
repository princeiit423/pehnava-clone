const CANCELLABLE_ORDER_STATUSES = Object.freeze([
  "order_placed",
  "payment_confirmed",
  "pending",
  "paid",
]);

const LEGACY_STATUS = {
  pending: "order_placed",
  paid: "payment_confirmed",
  processing: "processing_packed",
};

export function canCustomerCancelOrder(status) {
  const normalizedStatus = LEGACY_STATUS[status] || status;
  return normalizedStatus === "order_placed" || normalizedStatus === "payment_confirmed";
}

export function getCancellableOrderStatuses() {
  return CANCELLABLE_ORDER_STATUSES;
}
