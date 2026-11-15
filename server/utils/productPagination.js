const MAX_PAGE_SIZE = 50;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function parseProductPageSize(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Product page limit must be a positive whole number");
  }

  const pageSize = Number(value);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Product page limit must be a positive whole number");
  }
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

export function encodeProductCursor(product) {
  const createdAt = new Date(product.createdAt);
  if (Number.isNaN(createdAt.getTime()) || !OBJECT_ID_PATTERN.test(String(product._id))) {
    throw new Error("Cannot create a cursor for this product");
  }

  return Buffer.from(JSON.stringify({
    createdAt: createdAt.toISOString(),
    id: String(product._id),
  })).toString("base64url");
}

export function decodeProductCursor(value) {
  if (typeof value !== "string" || value.length > 256 || !/^[a-zA-Z\d_-]+$/.test(value)) {
    throw new Error("Invalid product cursor");
  }

  let cursor;
  try {
    cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid product cursor");
  }

  const createdAt = new Date(cursor?.createdAt);
  if (
    Number.isNaN(createdAt.getTime())
    || !OBJECT_ID_PATTERN.test(String(cursor?.id || ""))
  ) {
    throw new Error("Invalid product cursor");
  }

  return { createdAt, id: cursor.id };
}
