// Central config for every collection/category page.
// A product can belong to any number of these (via product.categories[])
// so it can show up under multiple sections/menus at once.
export const CATEGORIES = [
  { slug: "trending", label: "New DROP", type: "tag", tag: "new-drop" },
  { slug: "stitched-wear", label: "Ready To Wear", type: "tag", tag: "ready-to-wear" },
  { slug: "daily-wear", label: "Daily Wear", type: "tag", tag: "daily-wear" },
  { slug: "party-wear", label: "Party Wear", type: "tag", tag: "party-wear" },
  { slug: "festive-wear", label: "Festive Wear", type: "tag", tag: "festive-wear" },
  { slug: "celebrity-look", label: "Celebrity Look", type: "tag", tag: "celebrity-look" },
  { slug: "luxe", label: "LUXE", type: "tag", tag: "luxe" },
    { slug: "Unstitched", label: "Unstitched", type: "tag", tag: "Unstitched" },
  { slug: "save-more", label: "Sale Deals", type: "tag", tag: "sale-deals" },
  { slug: "suits-under-1699", label: "Suits Under ₹1,699", type: "price", max: 1699 },
  { slug: "suits-1700-3000", label: "₹1,700 - ₹3,000", type: "price", min: 1700, max: 3000 },
  { slug: "premium-suits-above-3-000", label: "Premium Suits ₹3,000+", type: "price", min: 3000 },
];

export const OUR_CATEGORY_STRIP = [
  { slug: "daily-wear", label: "Daily Wear" },
  { slug: "party-wear", label: "Party Wear" },
  { slug: "festive-wear", label: "Festive Wear" },
  { slug: "readymade", label: "Readymade" },
  { slug: "celebrity-look", label: "Celebrity Look" },
];

export function getCategoryConfig(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}
