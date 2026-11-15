import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Customer from "../models/Customer.js";
import { requireCustomer } from "../middleware/auth.js";
import { isValidCustomerEmail, isValidIndianPhone, normalizeCustomerEmail, normalizeIndianPhone } from "../utils/customerValidation.js";
import { normalizeShippingAddress } from "../utils/orderCheckout.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import { customerAuthRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
const tokenFor = (customer) => jwt.sign({ sub: customer._id.toString(), role: "customer", phone: customer.phone }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/register", customerAuthRateLimiter, async (req, res) => {
  try {
    const { name, phone, email, password, marketingConsent = false } = req.body;
    if (!name || !phone || !email || !password || password.length < 8) return res.status(400).json({ message: "Name, a valid phone number, email address and an 8 character password are required." });
    const normalizedPhone = normalizeIndianPhone(phone);
    const normalizedEmail = normalizeCustomerEmail(email);
    if (!isValidIndianPhone(normalizedPhone)) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });
    if (!isValidCustomerEmail(normalizedEmail)) return res.status(400).json({ message: "Enter a valid email address." });
    if (await Customer.exists({ phone: normalizedPhone })) return res.status(409).json({ message: "An account already exists for this phone number" });
    const customer = await Customer.create({ name: name.trim(), phone: normalizedPhone, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), marketingConsent: Boolean(marketingConsent) });
    res.status(201).json({ token: tokenFor(customer), customer: { id: customer._id, name: customer.name, phone: customer.phone, email: customer.email, marketingConsent: customer.marketingConsent } });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post("/login", customerAuthRateLimiter, async (req, res) => {
  const identifier = String(req.body.identifier || req.body.phone || "").trim();
  const normalizedPhone = identifier.replace(/[\s-]/g, "");
  const customer = await Customer.findOne({
    $or: [{ phone: normalizedPhone }, { email: identifier.toLowerCase() }],
  });
  if (!customer || !(await bcrypt.compare(req.body.password || "", customer.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
  res.json({ token: tokenFor(customer), customer: { id: customer._id, name: customer.name, phone: customer.phone, email: customer.email, marketingConsent: customer.marketingConsent } });
});

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.sub)
      .select("name phone email marketingConsent shippingAddress wishlist createdAt")
      .lean();
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    res.json(customer);
  } catch (error) {
    console.error("Load customer profile error:", error);
    res.status(500).json({ message: "Unable to load your account." });
  }
});

router.put("/me/shipping-address", requireCustomer, async (req, res) => {
  let shippingAddress;
  try {
    shippingAddress = normalizeShippingAddress(req.body);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "Enter a valid shipping address." });
  }

  try {
    const customer = await Customer.findByIdAndUpdate(
      req.user.sub,
      { $set: { shippingAddress } },
      { new: true, runValidators: true }
    ).select("shippingAddress");
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    res.json({ shippingAddress: customer.shippingAddress });
  } catch (error) {
    console.error("Save customer shipping address error:", error);
    res.status(500).json({ message: "Unable to save your shipping address." });
  }
});

router.put("/me/wishlist", requireCustomer, async (req, res) => {
  const productIds = req.body?.productIds;
  if (!Array.isArray(productIds) || productIds.length > 500 || productIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: "Provide up to 500 valid product IDs." });
  }
  const uniqueIds = [...new Set(productIds.map((id) => new mongoose.Types.ObjectId(id).toString()))];
  try {
    const availableProducts = await Product.find({ _id: { $in: uniqueIds } }).select("_id").lean();
    const availableIds = availableProducts.map((product) => product._id.toString());
    const customer = await Customer.findByIdAndUpdate(
      req.user.sub,
      { $set: { wishlist: availableIds } },
      { new: true, runValidators: true }
    ).select("wishlist");
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    res.json({ wishlist: customer.wishlist });
  } catch (error) {
    console.error("Save customer wishlist error:", error);
    res.status(500).json({ message: "Unable to save your wishlist." });
  }
});

router.patch("/me/wishlist", requireCustomer, async (req, res) => {
  const { productId, liked } = req.body || {};
  if (typeof productId !== "string" || !mongoose.isValidObjectId(productId) || typeof liked !== "boolean") {
    return res.status(400).json({ message: "A valid product ID and wishlist action are required." });
  }
  try {
    if (!await Product.exists({ _id: productId })) {
      return res.status(404).json({ message: "Product not found." });
    }
    const normalizedId = new mongoose.Types.ObjectId(productId).toString();
    const update = liked
      ? { $addToSet: { wishlist: normalizedId } }
      : { $pull: { wishlist: normalizedId } };
    const customer = await Customer.findByIdAndUpdate(req.user.sub, update, { new: true }).select("wishlist");
    if (!customer) return res.status(404).json({ message: "Customer account not found." });
    res.json({ wishlist: customer.wishlist });
  } catch (error) {
    console.error("Update customer wishlist error:", error);
    res.status(500).json({ message: "Unable to update your wishlist." });
  }
});
export default router;