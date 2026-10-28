import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    productTag: { type: String, trim: true, maxlength: 80, default: "" },
    type: { type: String, enum: ["tag", "price"], default: "tag" },
    minPrice: { type: Number, min: 0, default: null },
    maxPrice: { type: Number, min: 0, default: null },
    active: { type: Boolean, default: true },
    showOnHomepage: { type: Boolean, default: false },
    homepageOrder: { type: Number, min: 0, default: 0 },
    imageUrl: { type: String, maxlength: 2048, default: "" },
  },
  { _id: false }
);

const homeCarouselSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    source: { type: String, enum: ["newest", "tag", "price"], required: true },
    productTag: { type: String, trim: true, maxlength: 80, default: "" },
    categorySlug: { type: String, trim: true, maxlength: 60, default: "" },
    collectionSlug: { type: String, trim: true, maxlength: 60, default: "" },
    minPrice: { type: Number, min: 0, default: null },
    maxPrice: { type: Number, min: 0, default: null },
    minExclusive: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100, default: "" },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    hours: { type: String, trim: true, maxlength: 200, default: "" },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    mapsUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  },
  { _id: false }
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 80, default: "" },
    url: { type: String, trim: true, maxlength: 2048, default: "" },
  },
  { _id: false }
);

const storefrontSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "storefront" },
    categories: { type: [categorySchema], default: [] },
    homeCarousels: { type: [homeCarouselSchema], default: [] },
    announcements: { type: [String], default: [] },
    shopColors: {
      kicker: { type: String, maxlength: 120, default: "" },
      heading: { type: String, maxlength: 120, default: "" },
      description: { type: String, maxlength: 500, default: "" },
    },
    locations: { type: [locationSchema], default: [] },
    showroom: {
      kicker: { type: String, maxlength: 120, default: "" },
      heading: { type: String, maxlength: 120, default: "" },
      description: { type: String, maxlength: 500, default: "" },
    },
    contact: {
      heading: { type: String, maxlength: 120, default: "" },
      intro: { type: String, maxlength: 1000, default: "" },
      helpHeading: { type: String, maxlength: 120, default: "" },
      helpText: { type: String, maxlength: 1000, default: "" },
      whatsapp: { type: String, maxlength: 40, default: "" },
      email: { type: String, maxlength: 160, default: "" },
      instagram: { type: String, maxlength: 2048, default: "" },
    },
    story: { type: [String], default: [] },
    storyTitle: { type: String, maxlength: 120, default: "" },
    footer: {
      description: { type: String, maxlength: 1000, default: "" },
      address: { type: String, maxlength: 500, default: "" },
      instagramUrl: { type: String, maxlength: 2048, default: "" },
      links: { type: [linkSchema], default: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.model("StorefrontSettings", storefrontSettingsSchema);
