import express from "express";
import StorefrontSettings from "../models/StorefrontSettings.js";
import { requireAdmin } from "../middleware/auth.js";
import { DEFAULT_STOREFRONT_SETTINGS } from "../utils/storefrontDefaults.js";

const router = express.Router();

const LEGACY_INSTAGRAM_URL = "https://www.instagram.com/kashmirclothstores/";
const LEGACY_CATEGORY_LABELS = {
  trending: "New DROP",
  "stitched-wear": "Ready To Wear",
  "daily-wear": "Daily Wear",
  "party-wear": "Party Wear",
  "festive-wear": "Festive Wear",
  readymade: "Readymade",
  "celebrity-look": "Celebrity Look",
  luxe: "LUXE",
  unstitched: "Unstitched",
  "save-more": "Sale Deals",
  "suits-under-1699": "Suits Under ₹1,699",
  "suits-1700-3000": "₹1,700 - ₹3,000",
  "premium-suits-above-3-000": "Premium Suits ₹3,000+",
};
const LEGACY_CAROUSEL_TITLES = [
  "New Drop",
  "Ready To Wear",
  "Unstitched",
  "Suits Under ₹1,699",
  "₹1,700 - ₹3,000",
  "Premium 3000+",
];

function replaceLegacyBrand(value) {
  return String(value || "")
    .replace(/GhostFreak/gi, "RacoonBro")
    .replace(/ghostfreak777@gmail\.com/gi, "racoonbro777@gmail.com");
}

function isUnconfirmedBusinessPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return ["7004281547", "8292864636", "9876543210"].includes(digits);
}

function updateLegacyDefaultContent(saved) {
  if (!saved) return saved;
  const updated = { ...saved };

  if (Array.isArray(saved.categories) && saved.categories.length === Object.keys(LEGACY_CATEGORY_LABELS).length
    && saved.categories.every((category) => LEGACY_CATEGORY_LABELS[String(category.slug).toLowerCase()] === category.label)) {
    updated.categories = DEFAULT_STOREFRONT_SETTINGS.categories.map((category) => {
      const previous = saved.categories.find((entry) => String(entry.slug).toLowerCase() === category.slug.toLowerCase());
      return previous ? {
        ...category,
        active: previous.active,
        showOnHomepage: previous.showOnHomepage,
        homepageOrder: previous.homepageOrder,
        imageUrl: previous.imageUrl || "",
      } : category;
    });
  }
  if (Array.isArray(updated.categories)) {
    updated.categories = updated.categories.map((category) => ({
      ...category,
      label: replaceLegacyBrand(category.label),
    }));
  }
  if (Array.isArray(updated.homeCarousels)) {
    updated.homeCarousels = updated.homeCarousels.map((section) => ({
      ...section,
      title: replaceLegacyBrand(section.title),
    }));
  }
  for (const group of ["shopColors", "showroom"]) {
    if (updated[group]) {
      updated[group] = Object.fromEntries(
        Object.entries(updated[group]).map(([field, value]) => [field, replaceLegacyBrand(value)])
      );
    }
  }

  if (Array.isArray(saved.homeCarousels) && saved.homeCarousels.length === LEGACY_CAROUSEL_TITLES.length
    && saved.homeCarousels.every((section, index) => section.title === LEGACY_CAROUSEL_TITLES[index]
      && section.active !== false && Number(section.order || 0) === index)) {
    updated.homeCarousels = DEFAULT_STOREFRONT_SETTINGS.homeCarousels;
  }

  if (Array.isArray(saved.announcements)) {
    updated.announcements = saved.announcements.map((message) => {
      if (message === "Need help with an order? WhatsApp us at 7004281547") {
        return "Questions about an order? Email racoonbro777@gmail.com";
      }
      if (message === "Urgent delivery within 24 hours in Dhanbad, Asansol, Bokaro & nearby cities — order via Instagram") {
        return "RacoonBro — everyday essentials, on repeat.";
      }
      return replaceLegacyBrand(message);
    });
  }

  if (Array.isArray(saved.locations)) {
    updated.locations = saved.locations
      .filter((location) => !(location.name === "Kashmir Cloth Stores" && location.phone === "8292864636"))
      .map((location) => ({
        ...location,
        phone: isUnconfirmedBusinessPhone(location.phone) ? "" : location.phone,
      }));
  }

  const contact = { ...(saved.contact || {}) };
  if (isUnconfirmedBusinessPhone(contact.whatsapp)) contact.whatsapp = "";
  if (["kashmir.clothstores04@gmail.com", "ghostfreak777@gmail.com"].includes(String(contact.email || "").toLowerCase())) {
    contact.email = DEFAULT_STOREFRONT_SETTINGS.contact.email;
  }
  for (const field of ["heading", "intro", "helpHeading", "helpText"]) {
    if (contact[field]) contact[field] = replaceLegacyBrand(contact[field]);
  }
  if (contact.instagram === LEGACY_INSTAGRAM_URL) contact.instagram = "";
  updated.contact = contact;

  if (Array.isArray(saved.story) && saved.story.length === 5
    && saved.story[0]?.startsWith("Started Business in 1960s")
    && saved.story[4] === "Founder: Late Janab Akhtar Hussain") {
    updated.story = DEFAULT_STOREFRONT_SETTINGS.story;
  } else if (Array.isArray(saved.story)) {
    updated.story = saved.story.map(replaceLegacyBrand);
  }

  const footer = { ...(saved.footer || {}) };
  if (footer.description === "Beautiful Sarees, Lehenga, stitched & unstitched Suits for Women. Shirting & Suiting, Coat-Pant, Kurta and Sherwani Fabrics for Men.") {
    footer.description = DEFAULT_STOREFRONT_SETTINGS.footer.description;
  }
  if (footer.address === "Main Road Phusro Bazar, Bokaro, Jharkhand, India") footer.address = "";
  if (footer.instagramUrl === LEGACY_INSTAGRAM_URL) footer.instagramUrl = "";
  if (footer.description) footer.description = replaceLegacyBrand(footer.description);
  if (footer.links) {
    footer.links = footer.links.map((link) => ({ ...link, label: replaceLegacyBrand(link.label) }));
  }
  if (Array.isArray(footer.links)) footer.links = footer.links.filter((link) => link.url !== LEGACY_INSTAGRAM_URL);
  updated.footer = footer;
  if (updated.storyTitle) updated.storyTitle = replaceLegacyBrand(updated.storyTitle);

  return updated;
}

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
  if (typeof body.impressionTrackingEnabled !== "boolean") {
    throw new Error("Impression tracking must be enabled or disabled.");
  }
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
    impressionTrackingEnabled: body.impressionTrackingEnabled,
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
    const publicSettings = updateLegacyDefaultContent(saved);
    const result = { ...DEFAULT_STOREFRONT_SETTINGS, ...(publicSettings || {}) };
    result.categories = publicSettings ? (publicSettings.categories || []) : DEFAULT_STOREFRONT_SETTINGS.categories;
    result.homeCarousels = Array.isArray(publicSettings?.homeCarousels)
      ? publicSettings.homeCarousels.map((section) => ({
        ...section,
        collectionSlug: String(section.collectionSlug === undefined ? section.categorySlug || "" : section.collectionSlug).toLowerCase(),
      }))
      : DEFAULT_STOREFRONT_SETTINGS.homeCarousels;
    result.announcements = publicSettings ? (publicSettings.announcements || []) : DEFAULT_STOREFRONT_SETTINGS.announcements;
    result.shopColors = { ...DEFAULT_STOREFRONT_SETTINGS.shopColors, ...(publicSettings?.shopColors || {}) };
    result.locations = publicSettings ? (publicSettings.locations || []) : DEFAULT_STOREFRONT_SETTINGS.locations;
    result.story = publicSettings ? (publicSettings.story || []) : DEFAULT_STOREFRONT_SETTINGS.story;
    result.contact = { ...DEFAULT_STOREFRONT_SETTINGS.contact, ...(publicSettings?.contact || {}) };
    result.storyTitle = publicSettings?.storyTitle || DEFAULT_STOREFRONT_SETTINGS.storyTitle;
    result.footer = { ...DEFAULT_STOREFRONT_SETTINGS.footer, ...(publicSettings?.footer || {}) };
    result.impressionTrackingEnabled = publicSettings?.impressionTrackingEnabled === true;
    res.json(result);
  } catch (error) {
    console.error("Get storefront settings error:", error);
    res.status(500).json({ message: "Failed to load storefront settings." });
  }
});

router.put("/admin/storefront-settings", requireAdmin, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (body.impressionTrackingEnabled === undefined) {
      const current = await StorefrontSettings.findOne({ key: "storefront" })
        .select("impressionTrackingEnabled")
        .lean();
      body.impressionTrackingEnabled = current?.impressionTrackingEnabled === true;
    }
    const settings = validateSettings(body);
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
