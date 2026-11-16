export function changeCartItemSize(cart, key, size) {
  const itemIndex = cart.findIndex((item) => item.key === key);
  if (itemIndex < 0) return cart;

  const nextSize = typeof size === "string" ? size.trim() : "";
  if (!nextSize) throw new Error("Choose a valid size.");

  const item = cart[itemIndex];
  const nextKey = `${item.productId}::${item.color || ""}::${nextSize}`;
  if (nextKey === key) return cart;

  const existingIndex = cart.findIndex((entry) => entry.key === nextKey);
  const existingItem = existingIndex >= 0 ? cart[existingIndex] : null;
  const combinedQuantity = item.quantity + (existingItem?.quantity || 0);
  if (combinedQuantity > 20) {
    throw new Error("You can add up to 20 of this product option.");
  }

  if (existingItem) {
    return cart.flatMap((entry, index) => {
      if (index === itemIndex) return [];
      if (index === existingIndex) return [{ ...entry, quantity: combinedQuantity }];
      return [entry];
    });
  }

  return cart.map((entry, index) => (
    index === itemIndex ? { ...entry, size: nextSize, key: nextKey } : entry
  ));
}
