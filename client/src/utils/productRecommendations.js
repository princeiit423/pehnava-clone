export function getRelatedProduct(products, currentProduct) {
  if (!currentProduct) return null;

  const currentCategories = new Set(
    (currentProduct.categories || []).map((category) => String(category).toLowerCase())
  );
  const currentType = String(currentProduct.type || "").trim().toLowerCase();
  const currentFabric = String(currentProduct.fabric || "").trim().toLowerCase();

  return products
    .filter((candidate) => (
      candidate._id !== currentProduct._id
      && !candidate.soldOut
      && Number(candidate.stock ?? 1) > 0
    ))
    .map((candidate) => {
      const sharedCategories = (candidate.categories || []).filter((category) =>
        currentCategories.has(String(category).toLowerCase())
      ).length;
      const sameType = currentType
        && String(candidate.type || "").trim().toLowerCase() === currentType;
      const sameFabric = currentFabric
        && String(candidate.fabric || "").trim().toLowerCase() === currentFabric;
      return {
        candidate,
        score: sharedCategories * 4 + Number(sameType) * 2 + Number(sameFabric),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}
