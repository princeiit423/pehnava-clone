export function createPaymentItemSnapshot(product, item, quantity, size, color) {
  const title = String(product.title || product.name || item.title || "").trim();
  const slug = String(product.slug || item.slug || product._id || "").trim();
  const price = Number((Number(product.price) * (1 - Math.min(99, Number(product.discount) || 0) / 100)).toFixed(2));

  if (!title || title.length > 200 || !slug || !Number.isFinite(price) || price < 0) {
    return null;
  }

  return {
    productId: product._id.toString(),
    slug,
    title,
    image: product.images?.[0] || "",
    quantity,
    price,
    size,
    color,
  };
}
