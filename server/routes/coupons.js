import express from "express";
import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import Product from "../models/Product.js";
import { requireAdmin, requireCustomer } from "../middleware/auth.js";
import { createPaymentItemSnapshot } from "../utils/paymentItems.js";
import { calculateItemSubtotal } from "../utils/orderCheckout.js";
import { calculateCouponDiscount, normalizeCouponCode, normalizeCouponPayload } from "../utils/coupons.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (error) {
    console.error("Load admin coupons error:", error);
    res.status(500).json({ message: "Failed to load coupons." });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.create(normalizeCouponPayload(req.body));
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A coupon with this code already exists." });
    if (error.status === 400) return res.status(400).json({ message: error.message });
    console.error("Create admin coupon error:", error);
    res.status(500).json({ message: "Unable to create coupon." });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid coupon ID." });
  }
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { $set: normalizeCouponPayload(req.body) },
      { new: true, runValidators: true }
    );
    if (!coupon) return res.status(404).json({ message: "Coupon not found." });
    res.json(coupon);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A coupon with this code already exists." });
    if (error.status === 400) return res.status(400).json({ message: error.message });
    console.error("Update admin coupon error:", error);
    res.status(500).json({ message: "Unable to update coupon." });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid coupon ID." });
  }
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found." });
    res.json({ message: "Coupon deleted." });
  } catch (error) {
    console.error("Delete admin coupon error:", error);
    res.status(500).json({ message: "Unable to delete coupon." });
  }
});

router.post("/validate", requireCustomer, async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length || items.length > 30 || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    return res.status(400).json({ message: "A valid order is required to apply a coupon." });
  }

  try {
    const code = normalizeCouponCode(req.body.code);
    const productIds = items.map((item) => String(item.productId || ""));
    if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more products are invalid." });
    }

    const products = await Product.find({ _id: { $in: productIds } })
      .select("title slug images price discount");
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    const trustedItems = [];
    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return res.status(400).json({ message: "One or more products or quantities are invalid." });
      }
      const snapshot = createPaymentItemSnapshot(
        product,
        item,
        quantity,
        String(item.size || "").trim(),
        String(item.color || "").trim()
      );
      if (!snapshot) return res.status(409).json({ message: "A product is unavailable for this coupon." });
      trustedItems.push(snapshot);
    }

    const itemSubtotal = calculateItemSubtotal(trustedItems);
    const coupon = await Coupon.findOne({ code }).lean();
    const discountAmount = calculateCouponDiscount(coupon, itemSubtotal);
    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      itemSubtotal,
      discountAmount,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Validate customer coupon error:", error);
    res.status(500).json({ message: "Unable to validate coupon." });
  }
});

export default router;
