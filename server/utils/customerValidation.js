export function normalizeIndianPhone(value) {
  return String(value || "").trim();
}

export function isValidIndianPhone(value) {
  return /^[6-9]\d{9}$/.test(value);
}

export function normalizeCustomerEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidCustomerEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
