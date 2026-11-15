// Central config for every collection/category page.
// A product can belong to any number of these (via product.categories[])
// so it can show up under multiple sections/menus at once.
export const CATEGORIES = [
  { slug: "trending", label: "New Arrivals", type: "tag", tag: "new-drop" },
  { slug: "stitched-wear", label: "Tees & Polos", type: "tag", tag: "tees-and-polos" },
  { slug: "daily-wear", label: "Everyday Shirts", type: "tag", tag: "everyday-shirts" },
  { slug: "party-wear", label: "Casual Bottoms", type: "tag", tag: "casual-bottoms" },
  { slug: "festive-wear", label: "Layers & Overshirts", type: "tag", tag: "layers" },
  { slug: "readymade", label: "Everyday Essentials", type: "tag", tag: "essentials" },
  { slug: "celebrity-look", label: "Accessories", type: "tag", tag: "accessories" },
  { slug: "luxe", label: "Premium Picks", type: "tag", tag: "premium" },
  { slug: "save-more", label: "Sale", type: "tag", tag: "sale-deals" },
  { slug: "suits-under-1699", label: "Essentials Under ₹1,699", type: "price", max: 1699 },
  { slug: "suits-1700-3000", label: "Everyday Wear ₹1,700–₹3,000", type: "price", min: 1700, max: 3000 },
  { slug: "premium-suits-above-3-000", label: "Premium Picks ₹3,000+", type: "price", min: 3000 },
];

export const OUR_CATEGORY_STRIP = [
  { slug: "daily-wear", label: "Everyday Shirts" },
  { slug: "party-wear", label: "Casual Bottoms" },
  { slug: "festive-wear", label: "Layers & Overshirts" },
  { slug: "readymade", label: "Everyday Essentials" },
  { slug: "celebrity-look", label: "Accessories" },
];

export function getCategoryConfig(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}
