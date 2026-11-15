export const DEFAULT_HOME_CAROUSELS = [
  { id: "new-drop", title: "New Arrivals", source: "newest", categorySlug: "", collectionSlug: "trending" },
  { id: "tees-and-polos", title: "Tees & Polos", source: "tag", productTag: "tees-and-polos", categorySlug: "stitched-wear", collectionSlug: "stitched-wear" },
  { id: "everyday-shirts", title: "Everyday Shirts", source: "tag", productTag: "everyday-shirts", categorySlug: "daily-wear", collectionSlug: "daily-wear" },
  { id: "casual-bottoms", title: "Casual Bottoms", source: "tag", productTag: "casual-bottoms", categorySlug: "party-wear", collectionSlug: "party-wear" },
  { id: "layers", title: "Layers & Overshirts", source: "tag", productTag: "layers", categorySlug: "festive-wear", collectionSlug: "festive-wear" },
  { id: "essentials", title: "Everyday Essentials", source: "tag", productTag: "essentials", categorySlug: "readymade", collectionSlug: "readymade" },
  { id: "essentials-under-1699", title: "Essentials Under ₹1,699", source: "price", maxPrice: 1699, categorySlug: "", collectionSlug: "suits-under-1699" },
  { id: "everyday-1700-3000", title: "Everyday Wear ₹1,700–₹3,000", source: "price", minPrice: 1700, maxPrice: 3000, categorySlug: "", collectionSlug: "suits-1700-3000" },
  { id: "premium-above-3000", title: "Premium Picks ₹3,000+", source: "price", minPrice: 3000, minExclusive: true, categorySlug: "", collectionSlug: "premium-suits-above-3-000" },
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
