import express from "express";
import StorefrontSettings from "../models/StorefrontSettings.js";
import { requireAdmin } from "../middleware/auth.js";
import { DEFAULT_STOREFRONT_SETTINGS } from "../utils/storefrontDefaults.js";

const router = express.Router();

function cleanText(value, field, maxLength, required = false) {
  const text = String(value ?? "").trim();
  if ((required && !text) || text.length > maxLength) {
    throw new Error(`${field} is required and must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function cleanHttpsUrl(value, field, optional = true) {
  const text = cleanText(value, field, 2048);
  if (!text && optional) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch {
    throw new Error(`${field} must be a valid HTTPS URL.`);
  }
  return text;
}

function validateSettings(body) {
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const homeCarousels = Array.isArray(body.homeCarousels)
    ? body.homeCarousels
    : DEFAULT_STOREFRONT_SETTINGS.homeCarousels;
  const announcements = Array.isArray(body.announcements) ? body.announcements : [];
  const locations = Array.isArray(body.locations) ? body.locations : [];
  const story = Array.isArray(body.story) ? body.story : [];
  const footerLinks = Array.isArray(body.footer?.links) ? body.footer.links : [];
  if (categories.length > 50 || homeCarousels.length > 20 || announcements.length > 10 || locations.length > 20 || story.length > 12 || footerLinks.length > 20) {
    throw new Error("The storefront settings limit was exceeded.");
  }
  const slugs = new Set();
  const cleanCategories = categories.map((category) => {
    const slug = cleanText(category.slug, "Category slug", 60, true).toLowerCase();
    if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      throw new Error("Category slugs must be unique letters, numbers, and hyphens.");
    }
    slugs.add(slug);
    const type = category.type === "price" ? "price" : "tag";
    const minPrice = category.minPrice === "" || category.minPrice == null ? null : Number(category.minPrice);
    const maxPrice = category.maxPrice === "" || category.maxPrice == null ? null : Number(category.maxPrice);
    if ([minPrice, maxPrice].some((price) => price != null && (!Number.isFinite(price) || price < 0))) {
      throw new Error(`Category ${slug} has an invalid price range.`);
    }
    return {
      slug,
      label: cleanText(category.label, "Category name", 80, true),
      productTag: cleanText(category.productTag, "Product tag", 80),
      type,
      minPrice,
      maxPrice,
      active: category.active !== false,
      showOnHomepage: category.showOnHomepage === true,
      homepageOrder: Math.max(0, Number(category.homepageOrder) || 0),
      imageUrl: cleanHttpsUrl(category.imageUrl, "Category image URL"),
    };
  });
  const carouselIds = new Set();
  const cleanHomeCarousels = homeCarousels.map((section, index) => {
    const id = cleanText(section.id, "Carousel ID", 80, true).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || carouselIds.has(id)) {
      throw new Error("Carousel IDs must be unique letters, numbers, and hyphens.");
    }
    carouselIds.add(id);
    const source = ["newest", "tag", "price"].includes(section.source) ? section.source : "tag";
    const minPrice = section.minPrice === "" || section.minPrice == null ? null : Number(section.minPrice);
    const maxPrice = section.maxPrice === "" || section.maxPrice == null ? null : Number(section.maxPrice);
    if ([minPrice, maxPrice].some((price) => price != null && (!Number.isFinite(price) || price < 0))) {
      throw new Error(`Carousel ${id} has an invalid price range.`);
    }
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      throw new Error(`Carousel ${id} minimum price cannot exceed its maximum price.`);
    }
    if (source === "tag" && !String(section.productTag || "").trim()) {
      throw new Error(`Carousel ${id} needs a product tag.`);
    }
    const collectionSlug = cleanText(
      section.collectionSlug !== undefined ? section.collectionSlug : section.categorySlug,
      "Carousel collection",
      60
    ).toLowerCase();
    if (collectionSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collectionSlug)) {
      throw new Error(`Carousel ${id} has an invalid collection slug.`);
    }
    return {
      id,
      title: cleanText(section.title, "Carousel title", 100, true),
      source,
      productTag: cleanText(section.productTag, "Carousel product tag", 80),
      categorySlug: cleanText(section.categorySlug, "Carousel category", 60),
      collectionSlug,
      minPrice,
      maxPrice,
      minExclusive: section.minExclusive === true,
      active: section.active !== false,
      order: Math.max(0, Number(section.order ?? index) || 0),
    };
  });
  const cleanLocations = locations.map((location) => ({
    name: cleanText(location.name, "Location name", 100),
    address: cleanText(location.address, "Location address", 500),
    hours: cleanText(location.hours, "Location hours", 200),
    phone: cleanText(location.phone, "Location phone", 40),
    mapsUrl: cleanHttpsUrl(location.mapsUrl, "Maps URL"),
  }));
  const cleanLinks = footerLinks.map((link) => ({
    label: cleanText(link.label, "Footer link label", 80),
    url: cleanText(link.url, "Footer link URL", 2048),
  })).filter((link) => link.label && link.url).map((link) => {
    if (link.url.startsWith("/") && !link.url.startsWith("//")) return link;
    return { ...link, url: cleanHttpsUrl(link.url, "Footer link URL", false) };
  });
  const contact = body.contact || {};
  const showroom = body.showroom || {};
  const shopColors = body.shopColors || {};
  return {
    categories: cleanCategories,
    homeCarousels: cleanHomeCarousels,
    announcements: announcements.map((text) => cleanText(text, "Announcement", 250)).filter(Boolean),
    shopColors: {
      kicker: cleanText(shopColors.kicker, "Shop by color kicker", 120),
      heading: cleanText(shopColors.heading, "Shop by color heading", 120),
      description: cleanText(shopColors.description, "Shop by color description", 500),
    },
    locations: cleanLocations,
    showroom: {
      kicker: cleanText(showroom.kicker, "Showroom kicker", 120),
      heading: cleanText(showroom.heading, "Showroom heading", 120),
      description: cleanText(showroom.description, "Showroom description", 500),
    },
    contact: {
      heading: cleanText(contact.heading, "Contact heading", 120),
      intro: cleanText(contact.intro, "Contact introduction", 1000),
      helpHeading: cleanText(contact.helpHeading, "Contact help heading", 120),
      helpText: cleanText(contact.helpText, "Contact help text", 1000),
      whatsapp: cleanText(contact.whatsapp, "WhatsApp number", 40),
      email: cleanText(contact.email, "Contact email", 160),
      instagram: cleanHttpsUrl(contact.instagram, "Instagram URL"),
    },
    story: story.map((text) => cleanText(text, "Story paragraph", 1500)).filter(Boolean),
    storyTitle: cleanText(body.storyTitle, "Our Story title", 120),
    footer: {
      description: cleanText(body.footer?.description, "Footer description", 1000),
      address: cleanText(body.footer?.address, "Footer address", 500),
      instagramUrl: cleanHttpsUrl(body.footer?.instagramUrl, "Footer Instagram URL"),
      links: cleanLinks,
    },
  };
}

router.get("/storefront-settings", async (req, res) => {
  try {
    const saved = await StorefrontSettings.findOne({ key: "storefront" }).lean();
    const result = { ...DEFAULT_STOREFRONT_SETTINGS, ...(saved || {}) };
    result.categories = saved ? (saved.categories || []) : DEFAULT_STOREFRONT_SETTINGS.categories;
    result.homeCarousels = Array.isArray(saved?.homeCarousels)
      ? saved.homeCarousels.map((section) => ({
        ...section,
        collectionSlug: String(section.collectionSlug === undefined ? section.categorySlug || "" : section.collectionSlug).toLowerCase(),
      }))
      : DEFAULT_STOREFRONT_SETTINGS.homeCarousels;
    result.announcements = saved ? (saved.announcements || []) : DEFAULT_STOREFRONT_SETTINGS.announcements;
    result.shopColors = { ...DEFAULT_STOREFRONT_SETTINGS.shopColors, ...(saved?.shopColors || {}) };
    result.locations = saved ? (saved.locations || []) : DEFAULT_STOREFRONT_SETTINGS.locations;
    result.story = saved ? (saved.story || []) : DEFAULT_STOREFRONT_SETTINGS.story;
    result.contact = { ...DEFAULT_STOREFRONT_SETTINGS.contact, ...(saved?.contact || {}) };
    result.storyTitle = saved?.storyTitle || DEFAULT_STOREFRONT_SETTINGS.storyTitle;
    result.footer = { ...DEFAULT_STOREFRONT_SETTINGS.footer, ...(saved?.footer || {}) };
    res.json(result);
  } catch (error) {
    console.error("Get storefront settings error:", error);
    res.status(500).json({ message: "Failed to load storefront settings." });
  }
});

router.put("/admin/storefront-settings", requireAdmin, async (req, res) => {
  try {
    const settings = validateSettings(req.body || {});
    const saved = await StorefrontSettings.findOneAndUpdate(
      { key: "storefront" },
      { $set: settings },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ ...DEFAULT_STOREFRONT_SETTINGS, ...saved });
  } catch (error) {
    res.status(400).json({ message: error.message || "Invalid storefront settings." });
  }
});

export default router;
