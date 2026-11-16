function getRelatednessScore(candidate, currentProduct) {
  const currentCategories = new Set(
    (currentProduct.categories || []).map((category) => String(category).toLowerCase())
  );
  const currentType = String(currentProduct.type || "").trim().toLowerCase();
  const currentFabric = String(currentProduct.fabric || "").trim().toLowerCase();

  const sharedCategories = (candidate.categories || []).filter((category) =>
    currentCategories.has(String(category).toLowerCase())
  ).length;
  const sameType = currentType
    && String(candidate.type || "").trim().toLowerCase() === currentType;
  const sameFabric = currentFabric
    && String(candidate.fabric || "").trim().toLowerCase() === currentFabric;
  return sharedCategories * 4 + Number(sameType) * 2 + Number(sameFabric);
}

function isAvailable(product) {
  return !product.soldOut && Number(product.stock ?? 1) > 0;
}

export function getRelatedProduct(products, currentProduct) {
  if (!currentProduct) return null;

  return products
    .filter((candidate) => candidate._id !== currentProduct._id && isAvailable(candidate))
    .map((candidate) => ({
      candidate,
      score: getRelatednessScore(candidate, currentProduct),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}

export function getRecommendedProducts(products, cartProducts, limit = 4) {
  if (!Array.isArray(products) || !Array.isArray(cartProducts) || cartProducts.length === 0) return [];

  const currentProducts = [...new Map(cartProducts
    .filter((product) => product?._id)
    .map((product) => [product._id, product])).values()];
  const cartProductIds = new Set(currentProducts.map((product) => product._id));
  const recommendationLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!currentProducts.length || !recommendationLimit) return [];

  return products
    .filter((candidate) => !cartProductIds.has(candidate._id) && isAvailable(candidate))
    .map((candidate, index) => ({
      candidate,
      index,
      score: currentProducts.reduce(
        (total, product) => total + getRelatednessScore(candidate, product),
        0
      ),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, recommendationLimit)
    .map(({ candidate }) => candidate);
}
