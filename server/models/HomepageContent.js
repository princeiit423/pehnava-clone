import mongoose from "mongoose";

const influencerPickSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 100, default: "" },
    creator: { type: String, trim: true, maxlength: 80, default: "" },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    mediaUrl: { type: String, required: true, maxlength: 2048 },
    posterUrl: { type: String, maxlength: 2048, default: "" },
    postUrl: { type: String, maxlength: 2048, default: "" },
  },
  { _id: false }
);

const instagramPostSchema = new mongoose.Schema(
  {
    mediaUrl: { type: String, required: true, maxlength: 2048 },
    postUrl: { type: String, required: true, maxlength: 2048 },
    caption: { type: String, trim: true, maxlength: 120, default: "" },
  },
  { _id: false }
);

const customerReviewSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const categoryImageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, maxlength: 60 },
    imageUrl: { type: String, required: true, maxlength: 2048 },
  },
  { _id: false }
);

const homepageContentSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "home" },
    heroDesktopImages: { type: [String], default: [] },
    heroMobileImages: { type: [String], default: [] },
    categoryImages: { type: [categoryImageSchema], default: [] },
    showroomImages: { type: [String], default: [] },
    influencerPicks: { type: [influencerPickSchema], default: [] },
    instagramPosts: { type: [instagramPostSchema], default: [] },
    reviews: { type: [customerReviewSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("HomepageContent", homepageContentSchema);
