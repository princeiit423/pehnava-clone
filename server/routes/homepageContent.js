import express from "express";
import HomepageContent from "../models/HomepageContent.js";

const router = express.Router();

const LEGACY_BRAND_ASSETS = [
  "Pehnava-Banner-lawns_xbl4up.webp",
  "Effortless_Elegance_Fashion_Editorial_xyyahu.png",
  "ratio-mobile-hero_siahdh.png",
  "ratio-mobile-hero-2_qbhncd.png",
  "/showroom/kashmir-storefront.png",
];

function withoutLegacyBrandAssets(images = []) {
  return images.filter((image) => !LEGACY_BRAND_ASSETS.some((asset) => String(image).includes(asset)));
}

router.get("/", async (req, res) => {
  try {
    const content = await HomepageContent.findOne({ key: "home" }).lean();
    res.json({
      heroDesktopImages: withoutLegacyBrandAssets(content?.heroDesktopImages || []),
      heroMobileImages: withoutLegacyBrandAssets(content?.heroMobileImages || []),
      categoryImages: content?.categoryImages || [],
      showroomImages: withoutLegacyBrandAssets(content?.showroomImages || []),
      influencerPicks: content?.influencerPicks || [],
      instagramPosts: content?.instagramPosts || [],
      reviews: content?.reviews || [],
    });
  } catch (error) {
    console.error("Get homepage content error:", error);
    res.status(500).json({ message: "Failed to load homepage content" });
  }
});

export default router;
