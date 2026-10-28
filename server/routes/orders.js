import express from "express";
import Order from "../models/Order.js";
import PaymentIntent from "../models/PaymentIntent.js";
import Product from "../models/Product.js";
import { requireCustomer, requireAdmin } from "../middleware/auth.js";
import { notifyOrder } from "../services/notifications.js";
import { asyncHandler } from "../utils/razorpay.js";

const router = express.Router();
router.get("/", requireCustomer, async (req, res) => res.json(await Order.find({ customer: req.user.sub }).sort({ createdAt: -1 })));
router.post("/", requireCustomer, asyncHandler(async (req, res) => {
  const { paymentMethod, paymentIntentId } = req.body || {};
  if (paymentMethod !== "razorpay" || !paymentIntentId) {
    return res.status(400).json({ message: "A verified Razorpay payment is required to place an order" });
  }

  let intent = await PaymentIntent.findOne({ _id: paymentIntentId, customer: req.user.sub });
  if (!intent) return res.status(404).json({ message: "Checkout session not found" });
  if (intent.status === "completed" && intent.order) {
    const existingOrder = await Order.findOne({ _id: intent.order, customer: req.user.sub });
    if (existingOrder) return res.json(existingOrder);
  }
  if (intent.status !== "verified") {
    return res.status(409).json({ message: "Payment must be verified before an order can be placed" });
  }
  intent = await PaymentIntent.findOneAndUpdate(
    { _id: intent._id, status: "verified" },
    { $set: { status: "processing" } },
    { new: true }
  );
  if (!intent) return res.status(409).json({ message: "This payment is already being added to your orders" });

  const { items, shippingAddress, paymentId } = intent;
  let order;
  let stockCommitted = false;
  const reservedItems = [];
  try {
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("title slug images price discount stock variantStock colors sizes");
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    const stockAdjustments = [];
    const trustedItems = [];

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      if (!product) throw Object.assign(new Error("One or more products are unavailable"), { status: 400 });

      const hasVariants = product.variantStock?.length > 0;
      const color = String(item.color || "").trim();
      const size = String(item.size || "").trim();
      const variant = hasVariants
        ? product.variantStock.find((entry) => entry.size === size && entry.color === color)
        : null;
      const productColor = product.colors?.find((entry) => entry.name === color);
      const hasColorStock = productColor?.stock !== undefined && productColor?.stock !== null;
      if (
        (hasVariants && (!variant || variant.stock < quantity)) ||
        Number(product.stock || 0) < quantity ||
        (product.colors?.length && !productColor) ||
        (hasColorStock && productColor.stock < quantity) ||
        (!hasVariants && product.sizes?.length && !product.sizes.includes(size))
      ) {
        throw Object.assign(new Error(`${product.title} does not have enough stock for the selected options.`), { status: 409 });
      }

      const price = Number(item.price);
      trustedItems.push({
        productId: product._id.toString(),
        slug: item.slug || product.slug || product._id.toString(),
        title: item.title || product.title || product.name,
        image: product.images?.[0] || "",
        quantity,
        price,
        size,
        color,
      });
      stockAdjustments.push({
        productId: product._id,
        title: product.title,
        quantity,
        size,
        color,
        variant: Boolean(variant),
        hasColorStock,
        stockAtRead: Number(product.stock || 0),
      });
    }

    const total = intent.total;
    order = await Order.create({
      customer: req.user.sub,
      items: trustedItems,
      total,
      paymentMethod,
      shippingAddress,
      paymentId,
      status: "payment_confirmed",
      source: "website",
    });

    for (const adjustment of stockAdjustments) {
      const filter = {
        _id: adjustment.productId,
        stock: { $gte: adjustment.quantity },
      };
      const increment = { stock: -adjustment.quantity };
      const options = {};
      if (adjustment.variant) {
        filter.variantStock = {
          $elemMatch: {
            size: adjustment.size,
            color: adjustment.color,
            stock: { $gte: adjustment.quantity },
          },
        };
        increment["variantStock.$.stock"] = -adjustment.quantity;
      }
      if (adjustment.hasColorStock) {
        filter.colors = {
          $elemMatch: {
            name: adjustment.color,
            stock: { $gte: adjustment.quantity },
          },
        };
        if (adjustment.variant) {
          increment["colors.$[color].stock"] = -adjustment.quantity;
          options.arrayFilters = [{
            "color.name": adjustment.color,
            "color.stock": { $gte: adjustment.quantity },
          }];
        } else {
          increment["colors.$.stock"] = -adjustment.quantity;
        }
      }
      const reserved = await Product.updateOne(
        filter,
        {
          $inc: increment,
          $set: { soldOut: adjustment.stockAtRead <= adjustment.quantity },
        },
        options
      );
      if (!reserved.modifiedCount) {
        throw Object.assign(new Error(`${adjustment.title} stock changed before the order could be confirmed. No order was saved; refresh inventory and try again.`), { status: 409 });
      }
      reservedItems.push(adjustment);
    }

    const completedIntent = await PaymentIntent.updateOne(
      { _id: intent._id, status: "processing" },
      { $set: { status: "completed", order: order._id } }
    );
    if (!completedIntent.modifiedCount) {
      throw Object.assign(new Error("Order payment could not be linked to the saved order"), { status: 500 });
    }
    stockCommitted = true;
    try {
      await notifyOrder(order, "created");
    } catch (error) {
      console.error("Website order notification error:", error);
      return res.status(201).json({
        ...order.toObject(),
        warning: "The order was saved, but order notification could not be sent.",
      });
    }
    res.status(201).json(order);
  } catch (error) {
    if (stockCommitted) {
      console.error("Website order follow-up error:", error);
      return res.status(201).json({
        ...order.toObject(),
        warning: "The order was saved, but a follow-up step failed.",
      });
    }

    let rollbackFailed = false;
    for (const adjustment of reservedItems.reverse()) {
      const filter = { _id: adjustment.productId };
      const increment = { stock: adjustment.quantity };
      const options = {};
      if (adjustment.variant) {
        filter.variantStock = { $elemMatch: { size: adjustment.size, color: adjustment.color } };
        increment["variantStock.$.stock"] = adjustment.quantity;
      }
      if (adjustment.hasColorStock) {
        filter.colors = { $elemMatch: { name: adjustment.color } };
        if (adjustment.variant) {
          increment["colors.$[color].stock"] = adjustment.quantity;
          options.arrayFilters = [{ "color.name": adjustment.color }];
        } else {
          increment["colors.$.stock"] = adjustment.quantity;
        }
      }
      try {
        const result = await Product.updateOne(
          filter,
          { $inc: increment, $set: { soldOut: false } },
          options
        );
        if (!result.modifiedCount) rollbackFailed = true;
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("Website order stock rollback error:", rollbackError);
      }
    }
    if (order) {
      try {
        await order.deleteOne();
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("Website order record rollback error:", rollbackError);
      }
    }
    if (!rollbackFailed) {
      try {
        await PaymentIntent.updateOne({ _id: intent._id, status: "processing" }, { $set: { status: "verified" } });
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("Website payment intent rollback error:", rollbackError);
      }
    }
    console.error("Website order creation error:", error);
    res.status(rollbackFailed ? 500 : error.status || 400).json({
      message: rollbackFailed
        ? "Order confirmation failed and automatic rollback was incomplete. Check the order and product inventory before retrying."
        : error.message || "Unable to create order",
    });
  }
}));
router.get("/:id", requireCustomer, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.sub });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
});
router.post("/:id/review", requireCustomer, async (req, res) => {
  const rating = Number(req.body.rating);
  const text = String(req.body.text || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !text || text.length > 1000) {
    return res.status(400).json({ message: "Choose a 1–5 star rating and write a review under 1000 characters." });
  }
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.sub });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.status !== "delivered") return res.status(400).json({ message: "You can review an order after it has been delivered." });
  order.review = { rating, text, submittedAt: new Date() };
  await order.save();
  res.json({ review: order.review });
});
router.patch("/:id/tracking", requireAdmin, async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { trackingNumber: req.body.trackingNumber, carrier: req.body.carrier, status: "shipped" }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
});
export default router;