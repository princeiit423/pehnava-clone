export function parseProductImageUrls(value) {
  return [...new Set(
    String(value || "")
      .split(/[,\r\n]+/)
      .map((url) => url.trim())
      .filter(Boolean)
  )];
}

export function getProductGalleryImages(product, selectedColor) {
  const colorImages = product?.colors
    ?.find((color) => color.name === selectedColor)
    ?.images || [];
  const productImages = product?.images || [];

  return [...new Set([...colorImages, ...productImages].filter(Boolean))];
}
