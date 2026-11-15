import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import PaymentIntent from "../models/PaymentIntent.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { requireCustomer, requireAdmin } from "../middleware/auth.js";
import { notifyOrder } from "../services/notifications.js";
import { createPaymentItemSnapshot } from "../utils/paymentItems.js";
import {
  calculateCodFee,
  calculateItemSubtotal,
  isReturnRequestWithinWindow,
  normalizeShippingAddress,
} from "../utils/orderCheckout.js";
import { canCustomerCancelOrder } from "../utils/orderCancellation.js";
import { restoreOrderStock } from "../utils/orderInventory.js";
import { asyncHandler } from "../utils/razorpay.js";
import { calculateCouponDiscount, normalizeCouponCode } from "../utils/coupons.js";

const router = express.Router();

async function createCodOrder(req, res) {
  const { items, shippingAddress } = req.body || {};
  const checkoutId = String(req.body?.checkoutId || "").trim();
  if (!Array.isArray(items) || !items.length || items.length > 30 || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    return res.status(400).json({ message: "A valid item and shipping address are required" });
  }
  if (checkoutId.length < 8 || checkoutId.length > 100) {
    return res.status(400).json({ message: "A valid checkout reference is required. Refresh checkout and try again." });
  }
  const previousOrder = await Order.findOne({ checkoutId });
  if (previousOrder) {
    if (String(previousOrder.customer) !== String(req.user.sub)) {
      return res.status(409).json({ message: "This checkout reference is already in use. Refresh checkout and try again." });
    }
    return res.json(previousOrder);
  }
  const address = normalizeShippingAddress(shippingAddress);
  const productIds = items.map((item) => String(item?.productId || ""));
  if (productIds.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: "One or more products are invalid" });
  }

  const products = await Product.find({ _id: { $in: productIds } })
    .select("title slug images price discount codEligible stock variantStock colors sizes");
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const trustedItems = [];
  const stockAdjustments = [];

  for (const item of items) {
    const product = productMap.get(String(item.productId));
    const quantity = Number(item.quantity);
    const size = String(item.size || "").trim();
    const color = String(item.color || "").trim();
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ message: "One or more products or quantities are invalid" });
    }
    if (product.codEligible === false) {
      return res.status(409).json({ message: `${product.title} is not eligible for cash on delivery. Choose online payment instead.` });
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
    const hasColorStock = productColor?.stock !== undefined && productColor?.stock !== null;
    if (
      Number(product.stock || 0) < quantity ||
      (hasVariants && (!variant || variant.stock < quantity)) ||
      (product.colors?.length && !productColor) ||
      (hasColorStock && productColor.stock < quantity) ||
      (!hasVariants && product.sizes?.length && !product.sizes.includes(size))
    ) {
      return res.status(409).json({ message: `${snapshot.title} is unavailable in the selected options or quantity` });
    }

    trustedItems.push(snapshot);
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

  const itemSubtotal = calculateItemSubtotal(trustedItems);
  const couponCode = req.body?.couponCode ? normalizeCouponCode(req.body.couponCode) : "";
  const coupon = couponCode ? await Coupon.findOne({ code: couponCode }).lean() : null;
  const couponDiscount = couponCode ? calculateCouponDiscount(coupon, itemSubtotal) : 0;
  const discountedSubtotal = Number((itemSubtotal - couponDiscount).toFixed(2));
  const codFee = calculateCodFee(discountedSubtotal);
  const total = Number((discountedSubtotal + codFee).toFixed(2));
  const reservedItems = [];
  let order;
  try {
    for (const adjustment of stockAdjustments) {
      const filter = { _id: adjustment.productId, stock: { $gte: adjustment.quantity } };
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
      const reservedQuantity = reservedItems
        .filter((entry) => String(entry.productId) === String(adjustment.productId))
        .reduce((total, entry) => total + entry.quantity, adjustment.quantity);
      const reserved = await Product.updateOne(
        filter,
        { $inc: increment, $set: { soldOut: adjustment.stockAtRead <= reservedQuantity } },
        options
      );
      if (!reserved.modifiedCount) {
        throw Object.assign(new Error(`${adjustment.title} stock changed before the order could be placed. Refresh inventory and try again.`), { status: 409 });
      }
      reservedItems.push(adjustment);
    }

    order = await Order.create({
      customer: req.user.sub,
      items: trustedItems,
      itemSubtotal,
      couponCode,
      couponDiscount,
      codFee,
      total,
      checkoutId,
      paymentMethod: "cod",
      shippingAddress: address,
      status: "order_placed",
      source: "website",
    });
  } catch (error) {
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
        const restored = await Product.updateOne(
          filter,
          { $inc: increment, $set: { soldOut: false } },
          options
        );
        if (!restored.modifiedCount) rollbackFailed = true;
      } catch (rollbackError) {
        rollbackFailed = true;
        console.error("COD order stock rollback error:", rollbackError);
      }
    }
    console.error("COD order creation error:", error);
    if (error.code === 11000 || error.status === 409) {
      const existingOrder = await Order.findOne({ checkoutId, customer: req.user.sub });
      if (existingOrder) return res.json(existingOrder);
    }
    return res.status(rollbackFailed ? 500 : error.status || 400).json({
      message: rollbackFailed
        ? "Order creation failed and automatic inventory rollback was incomplete. Contact support before retrying."
        : error.message || "Unable to place COD order",
    });
  }

  try {
    await notifyOrder(order, "created");
  } catch (error) {
    console.error("COD order notification error:", error);
    return res.status(201).json({ ...order.toObject(), warning: "The order was saved, but order notification could not be sent." });
  }
  return res.status(201).json(order);
}

router.get("/", requireCustomer, async (req, res) => res.json(await Order.find({ customer: req.user.sub }).sort({ createdAt: -1 })));
router.post("/:id/cancel", requireCustomer, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid order." });
  }

  const existingOrder = await Order.findOne({
    _id: req.params.id,
    customer: req.user.sub,
  });
  if (!existingOrder) return res.status(404).json({ message: "Order not found." });
  if (!canCustomerCancelOrder(existingOrder.status)) {
    return res.status(409).json({
      message: "This order can no longer be cancelled because it is already being processed or has moved to a later stage.",
    });
  }

  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: existingOrder._id,
      customer: req.user.sub,
      status: existingOrder.status,
      stockRestoredAt: null,
    },
    { $set: { status: "cancelled_refund" } },
    { new: true }
  );
  if (!cancelledOrder) {
    return res.status(409).json({
      message: "This order changed while you were cancelling it. Refresh your orders and try again.",
    });
  }

  try {
    await restoreOrderStock(cancelledOrder);
  } catch (error) {
    console.error("Customer order stock restoration error:", error);
    const rollback = await Order.updateOne(
      {
        _id: cancelledOrder._id,
        customer: req.user.sub,
        status: "cancelled_refund",
        stockRestoredAt: null,
      },
      { $set: { status: existingOrder.status } }
    );
    if (!rollback.modifiedCount) {
      console.error("Customer order cancellation rollback failed:", cancelledOrder._id);
      return res.status(500).json({
        message: "Order cancellation could not complete safely. Please contact the store for help.",
      });
    }
    return res.status(500).json({
      message: "Stock could not be restored, so the cancellation was rolled back. Please try again or contact the store.",
    });
  }

  try {
    await notifyOrder(cancelledOrder, "customer_cancelled");
  } catch (error) {
    console.error("Customer order cancellation notification error:", error);
  }
  res.json(cancelledOrder);
}));

router.post("/", requireCustomer, asyncHandler(async (req, res) => {
  const { paymentMethod, paymentIntentId } = req.body || {};
  if (paymentMethod === "cod") return createCodOrder(req, res);
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
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw Object.assign(new Error("One or more products or quantities are unavailable"), { status: 400 });
      }

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
      if (!Number.isFinite(price) || price < 0) {
        throw Object.assign(new Error("A verified product price is unavailable"), { status: 409 });
      }
      trustedItems.push({
        productId: String(item.productId),
        slug: item.slug,
        title: item.title,
        image: item.image || product.images?.[0] || "",
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
      itemSubtotal: intent.itemSubtotal ?? intent.total,
      couponCode: intent.couponCode,
      couponDiscount: intent.couponDiscount,
      codFee: 0,
      paymentMethod,
      shippingAddress,
      paymentId,
      status: "payment_confirmed",
      source: "website",
    });

    for (const adjustment of stockAdjustments) {
      const totalProductQuantity = stockAdjustments
        .filter((entry) => String(entry.productId) === String(adjustment.productId))
        .reduce((total, entry) => total + entry.quantity, 0);
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
          $set: { soldOut: adjustment.stockAtRead <= totalProductQuantity },
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

router.post("/:id/return-request", requireCustomer, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.sub });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.status !== "delivered") {
    return res.status(409).json({ message: "Return or exchange requests are available after delivery." });
  }
  if (!isReturnRequestWithinWindow(order)) {
    return res.status(409).json({ message: "The 7-day return and exchange request window has ended." });
  }
  if (order.returnRequest) {
    return res.status(409).json({ message: "A return or exchange request has already been submitted for this order." });
  }

  const type = String(req.body?.type || "");
  const reason = String(req.body?.reason || "").trim();
  if (!["return", "exchange"].includes(type) || reason.length < 5 || reason.length > 1000) {
    return res.status(400).json({ message: "Choose a return or exchange and provide a reason (5–1000 characters)." });
  }
  order.returnRequest = { type, reason, status: "requested", requestedAt: new Date() };
  await order.save();
  res.status(201).json(order);
}));

router.get("/:id", requireCustomer, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.sub });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
});
router.patch("/:id/tracking", requireAdmin, async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { trackingNumber: req.body.trackingNumber, carrier: req.body.carrier, status: "shipped" }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
});
export default router;