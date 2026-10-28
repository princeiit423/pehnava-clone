import express from "express";
import HomepageContent from "../models/HomepageContent.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const content = await HomepageContent.findOne({ key: "home" }).lean();
    res.json({
      heroDesktopImages: content?.heroDesktopImages || [],
      heroMobileImages: content?.heroMobileImages || [],
      categoryImages: content?.categoryImages || [],
      showroomImages: content?.showroomImages || [],
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
