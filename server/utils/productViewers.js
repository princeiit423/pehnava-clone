import crypto from "node:crypto";

export const PRODUCT_VIEWER_LEASE_MS = 60_000;

export function normalizeProductViewerId(value) {
  const viewerId = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(viewerId)) {
    throw Object.assign(new Error("A valid product viewer session is required"), { status: 400 });
  }
  return viewerId;
}

export function hashProductViewerId(viewerId) {
  return crypto.createHash("sha256").update(viewerId).digest("hex");
}

export function getProductViewerExpiry(now = Date.now()) {
  return new Date(now + PRODUCT_VIEWER_LEASE_MS);
}
