export const DEFAULT_HOME_CAROUSELS = [
  { id: "new-drop", title: "New Drop", source: "newest", categorySlug: "", collectionSlug: "trending" },
  { id: "ready-to-wear", title: "Ready To Wear", source: "tag", productTag: "ready-to-wear", categorySlug: "stitched-wear", collectionSlug: "stitched-wear" },
  { id: "unstitched", title: "Unstitched", source: "tag", productTag: "Unstitched", categorySlug: "Unstitched", collectionSlug: "unstitched" },
  { id: "suits-under-1699", title: "Suits Under ₹1,699", source: "price", maxPrice: 1699, categorySlug: "", collectionSlug: "suits-under-1699" },
  { id: "suits-1700-3000", title: "₹1,700 - ₹3,000", source: "price", minPrice: 1700, maxPrice: 3000, categorySlug: "", collectionSlug: "suits-1700-3000" },
  { id: "premium-suits-above-3000", title: "Premium 3000+", source: "price", minPrice: 3000, minExclusive: true, categorySlug: "", collectionSlug: "premium-suits-above-3-000" },
].map((section, order) => ({ ...section, active: true, order }));

export function getOrderedHomeCarousels(sections = DEFAULT_HOME_CAROUSELS) {
  return sections
    .filter((section) => section.active !== false)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

export function getHomeCarouselProducts(products, section) {
  if (section.source === "newest") return products.slice(0, 10);

  if (section.source === "price") {
    return products.filter((product) => {
      const price = Number(product.price);
      return Number.isFinite(price) && price > 0
        && (section.minPrice == null || (section.minExclusive ? price > Number(section.minPrice) : price >= Number(section.minPrice)))
        && (section.maxPrice == null || price <= Number(section.maxPrice));
    }).slice(0, 10);
  }

  const tagValues = [section.productTag, section.categorySlug]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return products.filter((product) => product.categories?.some((category) =>
    tagValues.includes(String(category).toLowerCase())
    || (section.id === "unstitched" && String(category).toLowerCase() === "unstitched-wear")
  )).slice(0, 10);
}
