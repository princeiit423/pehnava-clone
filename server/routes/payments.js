import express from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireCustomer } from "../middleware/auth.js";
import Product from "../models/Product.js";
import PaymentIntent from "../models/PaymentIntent.js";
import { createPaymentItemSnapshot } from "../utils/paymentItems.js";
import { asyncHandler, requestRazorpay } from "../utils/razorpay.js";

const router = express.Router();
const FEEDBACK_REASONS = ["payment_method", "technical_issue", "changed_mind", "need_help", "other"];

router.post("/razorpay/order", requireCustomer, asyncHandler(async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Razorpay is not configured" });
  const { items, shippingAddress } = req.body || {};
  if (!Array.isArray(items) || !items.length || items.length > 30 || !shippingAddress) {
    return res.status(400).json({ message: "A valid item and shipping address are required" });
  }
  const requiredAddressFields = ["name", "phone", "address", "city", "state", "pinCode"];
  const address = Object.fromEntries(requiredAddressFields.map((field) => [field, String(shippingAddress[field] || "").trim()]));
  address.email = String(shippingAddress.email || "").trim().toLowerCase();
  if (
    requiredAddressFields.some((field) => !address[field]) ||
    address.name.length > 100 ||
    address.address.length > 250 ||
    address.city.length > 80 ||
    address.state.length > 80 ||
    !/^[6-9]\d{9}$/.test(address.phone.replace(/\D/g, "")) ||
    !/^\d{6}$/.test(address.pinCode)
  ) {
    return res.status(400).json({ message: "Enter a complete shipping address and valid 10-digit Indian phone number" });
  }
  if (address.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  try {
    const productIds = items.map((item) => String(item.productId || ""));
    if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more products are invalid" });
    }
    const products = await Product.find({ _id: { $in: productIds } })
      .select("title slug images price discount stock variantStock colors sizes");
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    const trustedItems = [];

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const quantity = Number(item.quantity);
      const size = String(item.size || "").trim();
      const color = String(item.color || "").trim();
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return res.status(400).json({ message: "One or more products or quantities are invalid" });
      }
      const snapshot = createPaymentItemSnapshot(product, item, quantity, size, color);
      if (!snapshot) {
        return res.status(409).json({ message: "This product is missing required catalog details. Please contact the store before ordering." });
      }
      const hasVariants = product.variantStock?.length > 0;
      const variant = hasVariants
        ? product.variantStock.find((entry) => entry.size === size && entry.color === color)
        : null;
      const productColor = product.colors?.find((entry) => entry.name === color);
      const enoughStock = Number(product.stock || 0) >= quantity
        && (!hasVariants || (variant && variant.stock >= quantity))
        && (!product.colors?.length || Boolean(productColor))
        && (productColor?.stock == null || productColor.stock >= quantity)
        && (hasVariants || !product.sizes?.length || product.sizes.includes(size));
      if (!enoughStock) {
        return res.status(409).json({ message: `${snapshot.title} is unavailable in the selected options or quantity` });
      }

      trustedItems.push(snapshot);
    }

    const total = Number(trustedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    const amountPaise = Math.round(total * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
      return res.status(400).json({ message: "Order total must be at least Rs. 1" });
    }
    const intentId = new mongoose.Types.ObjectId();
    const gatewayResponse = await requestRazorpay("/orders", {
      method: "POST",
      body: { amount: amountPaise, currency: "INR", receipt: `kcs-${intentId.toString()}` },
    });
    if (!gatewayResponse.ok) {
      console.error("Razorpay order creation failed:", gatewayResponse.status, gatewayResponse.data.error?.code || "unknown");
      return res.status(502).json({ message: "Unable to start Razorpay checkout. Please try again." });
    }
    const gatewayOrder = gatewayResponse.data;
    if (!gatewayOrder.id || gatewayOrder.amount !== amountPaise || gatewayOrder.currency !== "INR") {
      console.error("Razorpay returned an incomplete order response");
      return res.status(502).json({ message: "Razorpay could not initialize this order. Please try again." });
    }
    await PaymentIntent.create({
      _id: intentId,
      customer: req.user.sub,
      items: trustedItems,
      total,
      amountPaise,
      shippingAddress: address,
      razorpayOrderId: gatewayOrder.id,
    });
    res.status(201).json({
      id: gatewayOrder.id,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      name: "Kashmir Cloth Stores",
      description: "Secure order payment",
    });
  } catch (error) {
    console.error("Razorpay checkout initialization error:", error);
    res.status(error.status || 502).json({ message: error.status === 503 ? error.message : "Unable to start checkout. Please try again." });
  }
}));

router.post("/razorpay/verify", requireCustomer, asyncHandler(async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Razorpay is not configured" });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (!orderId || !paymentId || !signature) return res.status(400).json({ message: "Razorpay payment details are incomplete" });

  try {
    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId, customer: req.user.sub });
    if (!intent) return res.status(404).json({ message: "Checkout session not found" });
    if (["verified", "processing", "completed"].includes(intent.status)) {
      if (intent.paymentId !== paymentId) return res.status(409).json({ message: "This checkout session was paid using a different payment" });
      return res.json({ verified: true, paymentIntentId: intent._id, orderId: intent.order });
    }

    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const received = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expected);
    if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, received)) {
      return res.status(400).json({ message: "Payment signature could not be verified" });
    }

    const paymentResponse = await requestRazorpay(`/payments/${encodeURIComponent(paymentId)}`);
    if (!paymentResponse.ok) {
      console.error("Razorpay payment lookup failed:", paymentResponse.status, paymentResponse.data.error?.code || "unknown");
      return res.status(502).json({ message: "Unable to confirm payment with Razorpay. Please contact support before retrying." });
    }
    let payment = paymentResponse.data;
    if (payment.order_id !== orderId || payment.amount !== intent.amountPaise || payment.currency !== "INR") {
      return res.status(400).json({ message: "Payment details do not match this order" });
    }
    if (payment.status === "authorized") {
      const captureResponse = await requestRazorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, {
        method: "POST",
        body: { amount: intent.amountPaise, currency: "INR" },
      });
      if (!captureResponse.ok) {
        console.error("Razorpay payment capture failed:", captureResponse.status, captureResponse.data.error?.code || "unknown");
        return res.status(502).json({ message: "Payment is authorized but could not be captured. Please contact support." });
      }
      payment = captureResponse.data;
    }
    if (payment.status !== "captured") return res.status(409).json({ message: "Razorpay has not confirmed a captured payment" });

    const verifiedIntent = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: "initiated" },
      { $set: { status: "verified", paymentId } },
      { new: true }
    );
    if (!verifiedIntent) {
      const latest = await PaymentIntent.findById(intent._id);
      if (latest?.paymentId !== paymentId || !["verified", "completed"].includes(latest.status)) {
        return res.status(409).json({ message: "Checkout was already confirmed with a different payment" });
      }
      return res.json({ verified: true, paymentIntentId: latest._id, orderId: latest.order });
    }
    res.json({ verified: true, paymentIntentId: verifiedIntent._id });
  } catch (error) {
    console.error("Razorpay payment verification error:", error);
    res.status(error.status || 502).json({ message: error.status === 503 ? error.message : "Unable to verify payment. Please contact support before retrying." });
  }
}));

router.post("/razorpay/feedback", requireCustomer, asyncHandler(async (req, res) => {
  const { orderId, outcome, reason, details = "" } = req.body || {};
  if (
    typeof orderId !== "string" ||
    !orderId ||
    !["exited", "failed"].includes(outcome) ||
    !FEEDBACK_REASONS.includes(reason) ||
    typeof details !== "string" ||
    details.length > 500
  ) {
    return res.status(400).json({ message: "Choose a valid payment outcome and reason." });
  }
  const intent = await PaymentIntent.findOne({
    razorpayOrderId: orderId,
    customer: req.user.sub,
    status: "initiated",
  });
  if (!intent) return res.status(404).json({ message: "Payment attempt is no longer available." });

  intent.feedback.push({ outcome, reason, details: details.trim() });
  if (intent.feedback.length > 20) intent.feedback = intent.feedback.slice(-20);
  await intent.save();
  res.status(201).json({ recorded: true });
}));

export default router;