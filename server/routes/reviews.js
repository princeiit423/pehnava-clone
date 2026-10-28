import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { requireAdmin, requireCustomer } from "../middleware/auth.js";
import { asyncHandler } from "../utils/razorpay.js";
import { deleteReviewImages, IMAGE_TYPES, MAX_IMAGE_SIZE, uploadReviewImage } from "../services/reviewImages.js";

const router = express.Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 3 },
  fileFilter(req, file, callback) {
    if (!IMAGE_TYPES.has(file.mimetype)) {
      const error = new Error("Review images must be JPEG, PNG, or WebP files.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
}).array("images", 3);

function parseReviewImages(req, res, next) {
  imageUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      error.status = 400;
      if (error.code === "LIMIT_FILE_SIZE") error.message = "Each review image must be 5 MB or smaller.";
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        error.message = "Upload no more than 3 review images.";
      }
    }
    next(error);
  });
}

function validateReviewText(body) {
  const rating = Number(body.rating);
  const text = String(body.text || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !text || text.length > 1000) {
    const error = new Error("Choose a 1–5 star rating and write a review under 1000 characters.");
    error.status = 400;
    throw error;
  }
  return { rating, text };
}

function publicReview(review) {
  return {
    _id: review._id,
    product: String(review.product),
    order: String(review.order),
    authorName: review.authorName,
    rating: review.rating,
    text: review.text,
    images: review.images,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

async function uploadImages(files) {
  const uploaded = [];
  try {
    for (const file of files) uploaded.push(await uploadReviewImage(file));
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      try {
        await deleteReviewImages(uploaded);
      } catch (cleanupError) {
        console.error("Failed to clean up review images after upload failure:", cleanupError);
      }
    }
    throw error;
  }
}

async function removeImagesWithWarning(images) {
  try {
    await deleteReviewImages(images);
    return false;
  } catch (error) {
    console.error("Cloudinary review image cleanup failed:", error);
    return true;
  }
}

router.get("/products/:slug", asyncHandler(async (req, res) => {
  let product = await Product.findOne({ slug: req.params.slug }).select("_id");
  if (!product && mongoose.isValidObjectId(req.params.slug)) {
    product = await Product.findById(req.params.slug).select("_id");
  }
  if (!product) return res.status(404).json({ message: "Product not found" });
  const reviews = await Review.find({ product: product._id }).sort({ createdAt: -1 }).lean();
  res.json(reviews.map(publicReview));
}));

router.get("/mine", requireCustomer, asyncHandler(async (req, res) => {
  const reviews = await Review.find({ customer: req.user.sub }).sort({ createdAt: -1 }).lean();
  res.json(reviews.map(publicReview));
}));

router.get("/admin", requireAdmin, asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate("product", "title slug")
    .populate("order", "createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.json(reviews);
}));

router.post("/orders/:orderId", requireCustomer, parseReviewImages, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId) || !mongoose.isValidObjectId(req.body.productId)) {
    return res.status(400).json({ message: "The order or product is invalid." });
  }
  const { rating, text } = validateReviewText(req.body);
  const order = await Order.findOne({ _id: req.params.orderId, customer: req.user.sub });
  if (!order) return res.status(404).json({ message: "Order not found." });
  if (order.status !== "delivered") {
    return res.status(400).json({ message: "You can review a product after its order has been delivered." });
  }
  const item = order.items.find((orderedItem) => orderedItem.productId === String(req.body.productId));
  if (!item || !mongoose.isValidObjectId(item.productId)) {
    return res.status(403).json({ message: "You can only review a product from this delivered order." });
  }
  const [product, customer, existingReview] = await Promise.all([
    Product.findById(item.productId).select("_id"),
    Customer.findById(req.user.sub).select("name"),
    Review.exists({ order: order._id, product: item.productId }),
  ]);
  if (!product) return res.status(404).json({ message: "The reviewed product no longer exists." });
  if (!customer) return res.status(401).json({ message: "Sign in again to submit a review." });
  if (existingReview) return res.status(409).json({ message: "You have already reviewed this product from this order." });

  const images = await uploadImages(req.files || []);
  try {
    const review = await Review.create({
      product: product._id,
      order: order._id,
      customer: customer._id,
      authorName: customer.name,
      rating,
      text,
      images,
    });
    res.status(201).json({ review: publicReview(review) });
  } catch (error) {
    if (images.length) {
      try {
        await deleteReviewImages(images);
      } catch (cleanupError) {
        console.error("Failed to clean up review images after review creation failure:", cleanupError);
      }
    }
    if (error.code === 11000) return res.status(409).json({ message: "You have already reviewed this product from this order." });
    throw error;
  }
}));

router.patch("/:id", requireCustomer, parseReviewImages, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "The review is invalid." });
  const review = await Review.findOne({ _id: req.params.id, customer: req.user.sub });
  if (!review) return res.status(404).json({ message: "Review not found." });
  const { rating, text } = validateReviewText(req.body);

  let retainedIds = review.images.map((image) => image.publicId);
  if (req.body.keepImagePublicIds !== undefined) {
    try {
      retainedIds = JSON.parse(req.body.keepImagePublicIds);
    } catch {
      return res.status(400).json({ message: "The retained review images are invalid." });
    }
    if (!Array.isArray(retainedIds) || retainedIds.some((id) => typeof id !== "string")) {
      return res.status(400).json({ message: "The retained review images are invalid." });
    }
    const existingIds = new Set(review.images.map((image) => image.publicId));
    if (retainedIds.some((id) => !existingIds.has(id)) || new Set(retainedIds).size !== retainedIds.length) {
      return res.status(400).json({ message: "You can only keep images that belong to this review." });
    }
  }
  const files = req.files || [];
  if (retainedIds.length + files.length > 3) {
    return res.status(400).json({ message: "A review can include no more than 3 images." });
  }

  const newImages = await uploadImages(files);
  const removedImages = review.images.filter((image) => !retainedIds.includes(image.publicId));
  const retainedImages = review.images.filter((image) => retainedIds.includes(image.publicId));
  review.rating = rating;
  review.text = text;
  review.images = [...retainedImages, ...newImages];
  try {
    await review.save();
  } catch (error) {
    if (newImages.length) {
      try {
        await deleteReviewImages(newImages);
      } catch (cleanupError) {
        console.error("Failed to clean up review images after review update failure:", cleanupError);
      }
    }
    throw error;
  }

  const warning = await removeImagesWithWarning(removedImages);
  res.json({
    review: publicReview(review),
    ...(warning ? { warning: "Your review was updated, but one or more removed images could not be deleted from Cloudinary." } : {}),
  });
}));

router.delete("/admin/:id", requireAdmin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "The review is invalid." });
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found." });
  await review.deleteOne();
  const warning = await removeImagesWithWarning(review.images);
  res.json({
    message: "Review deleted.",
    ...(warning ? { warning: "The review was deleted, but one or more images could not be deleted from Cloudinary." } : {}),
  });
}));

router.delete("/:id", requireCustomer, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "The review is invalid." });
  const review = await Review.findOneAndDelete({ _id: req.params.id, customer: req.user.sub });
  if (!review) return res.status(404).json({ message: "Review not found." });
  const warning = await removeImagesWithWarning(review.images);
  res.json({
    message: "Review deleted.",
    ...(warning ? { warning: "Your review was deleted, but one or more images could not be deleted from Cloudinary." } : {}),
  });
}));

export default router;
