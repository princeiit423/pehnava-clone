import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import PaymentIntent from "../models/PaymentIntent.js";
import { requireAdmin } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { notifyOrder } from "../services/notifications.js";
import Product from "../models/Product.js";
import HomepageContent from "../models/HomepageContent.js";
import Review from "../models/Review.js";
import { buildOrderEmailHtml } from "../services/orderEmail.js";
import { isValidCustomerEmail, isValidIndianPhone, normalizeCustomerEmail, normalizeIndianPhone } from "../utils/customerValidation.js";

const router = express.Router();
const ORDER_STATUSES = [
  "order_placed",
  "payment_confirmed",
  "processing_packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled_refund",
];

async function restoreOrderStock(order, { skipUnavailable = false } = {}) {
  if (order.stockRestoredAt) return [];
  const unavailableItems = [];
  for (const item of order.items || []) {
    if (!item.productId || item.productId === "offline") continue;
    if (!mongoose.isValidObjectId(item.productId)) {
      if (skipUnavailable) {
        unavailableItems.push(item.title || "A product with an invalid inventory reference");
        continue;
      }
      throw new Error(`Unable to restore stock because product ${item.productId} has an invalid ID.`);
    }
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      if (skipUnavailable) {
        unavailableItems.push(item.title || "A product with an invalid quantity");
        continue;
      }
      throw new Error(`Unable to restore stock because ${item.title || "an order item"} has an invalid quantity.`);
    }
    const product = await Product.findById(item.productId).select("variantStock colors");
    if (!product) {
      if (skipUnavailable) {
        unavailableItems.push(item.title || "An unavailable product");
        continue;
      }
      throw new Error(`Unable to restore stock because product ${item.productId} no longer exists.`);
    }
    const variant = product.variantStock?.find(
      (entry) => String(entry.size || "").trim() === String(item.size || "").trim()
        && String(entry.color || "").trim() === String(item.color || "").trim()
    );
    if (product.variantStock?.length && !variant) {
      if (skipUnavailable) {
        unavailableItems.push(item.title || "A product with an unavailable variant");
        continue;
      }
      throw new Error(`Unable to locate the ordered inventory variant for ${item.title}.`);
    }
    const color = product.colors?.find((entry) => entry.name === item.color);
    const hasColorStock = color?.stock !== undefined && color?.stock !== null;
    const filter = { _id: product._id };
    const increment = { stock: item.quantity };
    const options = {};

    if (variant) {
      filter.variantStock = { $elemMatch: { size: item.size, color: item.color } };
      increment["variantStock.$.stock"] = item.quantity;
      if (hasColorStock) {
        filter.colors = { $elemMatch: { name: item.color } };
        increment["colors.$[color].stock"] = item.quantity;
        options.arrayFilters = [{ "color.name": item.color }];
      }
    } else if (hasColorStock) {
      filter.colors = { $elemMatch: { name: item.color } };
      increment["colors.$.stock"] = item.quantity;
    }

    const result = await Product.updateOne(
      filter,
      { $inc: increment, $set: { soldOut: false } },
      options
    );
    if (!result.modifiedCount) {
      if (skipUnavailable) {
        unavailableItems.push(item.title || "A product with unavailable inventory");
        continue;
      }
      throw new Error(`Unable to restore stock for product ${item.productId}.`);
    }
  }
  order.stockRestoredAt = new Date();
  await order.save();
  return unavailableItems;
}

async function rollbackManualOrderStock(adjustment) {
  const increment = {
    stock: adjustment.quantity,
  };
  const arrayFilters = [];

  if (adjustment.size && adjustment.color && adjustment.variant) {
    increment["variantStock.$.stock"] = adjustment.quantity;
    if (adjustment.hasColorStock) {
      increment["colors.$[color].stock"] = adjustment.quantity;
      arrayFilters.push({ "color.name": adjustment.color });
    }
  } else if (adjustment.hasColorStock) {
    increment["colors.$.stock"] = adjustment.quantity;
  }

  const filter = {
      _id: adjustment.productId,
      ...(adjustment.variant
        ? {
            variantStock: {
              $elemMatch: {
                size: adjustment.size,
                color: adjustment.color,
              },
            },
          }
        : {}),
      ...(adjustment.hasColorStock && !adjustment.variant
        ? { colors: { $elemMatch: { name: adjustment.color } } }
        : {}),
    };
  const update = {
    $inc: increment,
    $set: { soldOut: false },
  };
  const result = arrayFilters.length
    ? await Product.updateOne(filter, update, { arrayFilters })
    : await Product.updateOne(filter, update);

  if (!result.modifiedCount) {
    throw new Error(`Unable to restore stock for product ${adjustment.productId}`);
  }
}

async function reserveManualOrderStock(adjustment) {
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
    if (adjustment.hasColorStock) {
      filter.colors = {
        $elemMatch: {
          name: adjustment.color,
          stock: { $gte: adjustment.quantity },
        },
      };
      increment["colors.$[color].stock"] = -adjustment.quantity;
      options.arrayFilters = [{
        "color.name": adjustment.color,
        "color.stock": { $gte: adjustment.quantity },
      }];
    }
  } else if (adjustment.hasColorStock) {
    filter.colors = {
      $elemMatch: {
        name: adjustment.color,
        stock: { $gte: adjustment.quantity },
      },
    };
    increment["colors.$.stock"] = -adjustment.quantity;
  }

  const result = await Product.updateOne(
    filter,
    {
      $inc: increment,
      $set: { soldOut: adjustment.stockAtRead <= adjustment.quantity },
    },
    options
  );
  if (!result.modifiedCount) {
    throwOrderError(409, `${adjustment.title} stock changed before the order could be confirmed. No order was saved; refresh inventory and try again.`);
  }
}

function throwOrderError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function withCustomerId(customer) {
  const value = typeof customer.toObject === "function" ? customer.toObject() : customer;
  const publicValue = { ...value };
  delete publicValue.passwordHash;
  return { ...publicValue, customerId: `CUS-${String(value._id).toUpperCase()}` };
}

class InvalidHomepageContentError extends Error {}

function validateHttpsUrl(value, field, optional = false) {
  const url = String(value || "").trim();
  if (optional && !url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new InvalidHomepageContentError();
    }
  } catch {
    throw new InvalidHomepageContentError(`${field} must be a valid HTTPS URL.`);
  }

  if (url.length > 2048) {
    throw new InvalidHomepageContentError(`${field} must be 2048 characters or fewer.`);
  }

  return url;
}

function validateInstagramUrl(value) {
  const url = validateHttpsUrl(value, "Instagram post URL");
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) {
    throw new InvalidHomepageContentError("Instagram post URL must use instagram.com.");
  }
  return url;
}

function validateHomepageContent(body) {
  const picks = body.influencerPicks;
  const posts = body.instagramPosts;
  const reviews = Array.isArray(body.reviews) ? body.reviews : [];
  const desktopHeroInput = Array.isArray(body.heroDesktopImages) ? body.heroDesktopImages : [];
  const mobileHeroInput = Array.isArray(body.heroMobileImages) ? body.heroMobileImages : [];
  const categoryImageInput = Array.isArray(body.categoryImages) ? body.categoryImages : [];
  const showroomInput = Array.isArray(body.showroomImages) ? body.showroomImages : [];

  if (!Array.isArray(picks) || !Array.isArray(posts) || picks.length > 12 || posts.length > 12 || reviews.length > 12
    || desktopHeroInput.length > 8 || mobileHeroInput.length > 8 || categoryImageInput.length > 20 || showroomInput.length > 8) {
    throw new InvalidHomepageContentError("The homepage media limit was exceeded.");
  }
  const validateImageList = (images, field) => images
    .map((image) => validateHttpsUrl(image, field, true))
    .filter(Boolean);
  const heroDesktopImages = validateImageList(desktopHeroInput, "Desktop hero image URL");
  const heroMobileImages = validateImageList(mobileHeroInput, "Mobile hero image URL");
  const showroomImages = validateImageList(showroomInput, "Showroom image URL");
  const categorySlugs = new Set();
  const categoryImages = categoryImageInput.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new InvalidHomepageContentError("Category images must be valid entries.");
    }
    const slug = String(entry.slug || "").trim();
    if (!/^[a-z0-9-]{1,60}$/.test(slug) || categorySlugs.has(slug)) {
      throw new InvalidHomepageContentError("Category image slugs must be unique, lowercase slugs.");
    }
    categorySlugs.add(slug);
    const imageUrl = validateHttpsUrl(entry.imageUrl, "Category image URL", true);
    return imageUrl ? { slug, imageUrl } : null;
  }).filter(Boolean);

  const influencerPicks = picks.map((pick) => {
    if (!pick || typeof pick !== "object" || Array.isArray(pick)) {
      throw new InvalidHomepageContentError("Influencer picks must be valid media entries.");
    }
    const title = String(pick.title || "").trim();
    const creator = String(pick.creator || "").trim();
    const mediaType = String(pick.mediaType || "");
    if (title.length > 100 || creator.length > 80 || !["image", "video"].includes(mediaType)) {
      throw new InvalidHomepageContentError("Influencer titles must be under 100 characters, creator names under 80 characters, and media type must be photo/video.");
    }

    return {
      title,
      creator,
      mediaType,
      mediaUrl: validateHttpsUrl(pick.mediaUrl, "Influencer media URL"),
      posterUrl: validateHttpsUrl(pick.posterUrl, "Video poster URL", true),
      postUrl: validateHttpsUrl(pick.postUrl, "Influencer post URL", true),
    };
  });

  const instagramPosts = posts.map((post) => {
    if (!post || typeof post !== "object" || Array.isArray(post)) {
      throw new InvalidHomepageContentError("Instagram posts must be valid media entries.");
    }
    const caption = String(post.caption || "").trim();
    if (caption.length > 120) {
      throw new InvalidHomepageContentError("Instagram captions must be 120 characters or fewer.");
    }

    return {
      mediaUrl: validateHttpsUrl(post.mediaUrl, "Instagram thumbnail URL"),
      postUrl: validateInstagramUrl(post.postUrl),
      caption,
    };
  });

  const customerReviews = reviews.map((review) => {
    if (!review || typeof review !== "object" || Array.isArray(review)) {
      throw new InvalidHomepageContentError("Customer reviews must be valid entries.");
    }
    const customerName = String(review.customerName || "").trim();
    const text = String(review.text || "").trim();
    const rating = Number(review.rating);
    if (!customerName || customerName.length > 80 || !text || text.length > 500 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new InvalidHomepageContentError("Each customer review needs a name, a 1–5 star rating, and text under 500 characters.");
    }
    return { customerName, rating, text };
  });

  return {
    heroDesktopImages,
    heroMobileImages,
    categoryImages,
    showroomImages,
    influencerPicks,
    instagramPosts,
    reviews: customerReviews,
  };
}

router.put("/homepage-content", requireAdmin, async (req, res) => {
  try {
    const content = validateHomepageContent(req.body || {});
    const saved = await HomepageContent.findOneAndUpdate(
      { key: "home" },
      { $set: content },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      heroDesktopImages: saved.heroDesktopImages,
      heroMobileImages: saved.heroMobileImages,
      categoryImages: saved.categoryImages,
      showroomImages: saved.showroomImages,
      influencerPicks: saved.influencerPicks,
      instagramPosts: saved.instagramPosts,
      reviews: saved.reviews,
    });
  } catch (error) {
    if (error instanceof InvalidHomepageContentError || error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    console.error("Save homepage content error:", error);
    res.status(500).json({ message: "Failed to save homepage content" });
  }
});


// ============================================================
// ADMIN LOGIN
// ============================================================

router.post("/login", (req, res) => {
  const { password } = req.body;

  if (
    !process.env.ADMIN_PASSWORD ||
    !process.env.JWT_SECRET ||
    !password ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: "Wrong password",
    });
  }

  const token = jwt.sign(
    {
      role: "admin",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "2h",
    }
  );

  res.json({
    token,
  });
});


// ============================================================
// GET CUSTOMERS
// ============================================================

router.get(
  "/customers",
  requireAdmin,
  async (req, res) => {
    try {
      const customers = await Customer.find()
        .select(
          "name phone email marketingConsent createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

      res.json(customers.map(withCustomerId));
    } catch (error) {
      console.error(
        "Get customers error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load customers",
      });
    }
  }
);

router.post("/customers", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = normalizeIndianPhone(req.body.phone);
    const email = normalizeCustomerEmail(req.body.email);
    if (!name || name.length > 100 || !isValidIndianPhone(phone) || !isValidCustomerEmail(email)) {
      return res.status(400).json({ message: "Provide a customer name, valid 10-digit Indian phone number, and valid email address." });
    }
    const existing = await Customer.findOne({ phone });
    if (existing) return res.status(409).json({ message: "A customer already uses this phone number." });
    const customer = await Customer.create({
      name,
      phone,
      email,
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
    });
    res.status(201).json(withCustomerId(customer));
  } catch (error) {
    console.error("Create customer error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "A customer already uses this phone number." });
    }
    res.status(500).json({ message: "Failed to save customer details." });
  }
});

router.patch("/customers/:id", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = normalizeIndianPhone(req.body.phone);
    const email = normalizeCustomerEmail(req.body.email);
    if (!name || name.length > 100 || !isValidIndianPhone(phone) || !isValidCustomerEmail(email)) {
      return res.status(400).json({ message: "Provide a customer name, valid 10-digit Indian phone number, and valid email address." });
    }
    const existing = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
    if (existing) return res.status(409).json({ message: "Another customer already uses this phone number." });
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { name, phone, email } },
      { new: true, runValidators: true }
    ).select("name phone email marketingConsent createdAt");
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    await Order.updateMany(
      { customer: customer._id },
      { $set: {
        "shippingAddress.name": name,
        "shippingAddress.phone": phone,
        "shippingAddress.email": email,
        editedAt: new Date(),
        editedBy: "admin",
      } }
    );
    res.json(withCustomerId(customer));
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({ message: "Failed to update customer." });
  }
});

router.delete("/customers/:id", requireAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    await Order.updateMany(
      { customer: customer._id },
      {
        $set: {
          customer: null,
          "shippingAddress.name": "Deleted customer",
          "shippingAddress.phone": "Deleted",
          "shippingAddress.email": "",
          "shippingAddress.address": "Deleted",
          "shippingAddress.city": "Deleted",
          "shippingAddress.state": "Deleted",
          "shippingAddress.pinCode": "Deleted",
        },
        $unset: { review: 1 },
      }
    );
    await Review.updateMany(
      { customer: customer._id },
      { $set: { customer: null, authorName: "Deleted customer" } }
    );
    await customer.deleteOne();
    res.json({ message: "Customer profile and personal order details deleted; order records and reviews were retained anonymously." });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ message: "Failed to delete customer." });
  }
});


// ============================================================
// GET ORDERS
// ============================================================

router.get(
  "/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const orders = await Order.find()
        .populate(
          "customer",
          "name phone email"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

      res.json(orders);
    } catch (error) {
      console.error(
        "Get orders error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load orders",
      });
    }
  }
);

router.get("/payment-feedback", requireAdmin, async (req, res) => {
  try {
    const attempts = await PaymentIntent.find({ "feedback.0": { $exists: true } })
      .select("items total razorpayOrderId feedback createdAt")
      .populate("customer", "name phone email")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const feedbackEntries = attempts.flatMap((attempt) => attempt.feedback.map((feedback, index) => ({
      _id: `${attempt._id}-${feedback.createdAt?.getTime() || 0}-${index}`,
      orderId: attempt.razorpayOrderId,
      items: attempt.items.map(({ title, quantity }) => ({ title, quantity })),
      total: attempt.total,
      customer: attempt.customer ? {
        name: attempt.customer.name,
        phone: attempt.customer.phone,
        email: attempt.customer.email,
      } : null,
      outcome: feedback.outcome,
      reason: feedback.reason,
      details: feedback.details,
      createdAt: feedback.createdAt,
    })));
    feedbackEntries.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    res.json(feedbackEntries);
  } catch (error) {
    console.error("Get payment feedback error:", error);
    res.status(500).json({ message: "Failed to load payment feedback" });
  }
});


// ============================================================
// UPDATE ORDER STATUS / TRACKING
// ============================================================

router.patch(
  "/orders/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const update = {};

      if (req.body.status !== undefined) {
        if (!ORDER_STATUSES.includes(req.body.status)) {
          return res.status(400).json({ message: "Choose a valid order phase." });
        }
        update.status = req.body.status;
      }

      if (
        typeof req.body.trackingNumber ===
        "string"
      ) {
        update.trackingNumber =
          req.body.trackingNumber.trim();
      }

      if (
        typeof req.body.carrier ===
        "string"
      ) {
        update.carrier =
          req.body.carrier.trim();
      }

      if (req.body.shippingAddress !== undefined) {
        const address = req.body.shippingAddress;
        const fields = ["name", "phone", "email", "address", "city", "state", "pinCode"];
        if (!address || typeof address !== "object" || fields.some((field) =>
          typeof address[field] !== "string" || address[field].trim().length > (field === "address" ? 300 : 120)
        )) {
          return res.status(400).json({ message: "Provide valid customer and delivery details." });
        }
        update.shippingAddress = Object.fromEntries(fields.map((field) => [field, address[field].trim()]));
      }

      const existingOrder = await Order.findById(req.params.id);
      if (!existingOrder) return res.status(404).json({ message: "Order not found" });
      if (update.shippingAddress) {
        update.editedAt = new Date();
        update.editedBy = "admin";
      }

      if (update.status === "cancelled_refund" && existingOrder.status !== "cancelled_refund") {
        await restoreOrderStock(existingOrder);
        update.stockRestoredAt = existingOrder.stockRestoredAt;
      }
      const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
        .populate("customer", "name phone email");

      // Send notification when status
      // or tracking information changes.
      if (update.status || update.trackingNumber || update.shippingAddress) {
        await notifyOrder(
          order,
          update.shippingAddress
            ? "details"
            : update.trackingNumber
              ? "tracking"
              : "status"
        );
      }

      res.json(order);
    } catch (error) {
      console.error(
        "Update order error:",
        error
      );

      res.status(500).json({
        message: error.message || "Failed to update order",
      });
    }
  }
);


// ============================================================
// DELETE ORDER + RESTORE STOCK
// ============================================================

router.delete(
  "/orders/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          message:
            "Order not found",
        });
      }

      const unavailableItems = await restoreOrderStock(order, { skipUnavailable: true });

      await order.deleteOne();

      res.json({
        message: "Order deleted",
        ...(unavailableItems.length
          ? {
              warning: `Order deleted, but stock could not be restored for: ${unavailableItems.join(", ")}.`,
            }
          : { message: "Order deleted and stock restored" }),
      });
    } catch (error) {
      console.error(
        "Delete order error:",
        error
      );

      res.status(500).json({
        message: error.message || "Failed to delete order",
      });
    }
  }
);


// ============================================================
// SEND STRUCTURED ORDER EMAIL
// ============================================================

router.post(
  "/orders/:id/email",
  requireAdmin,
  async (req, res) => {
    try {
      const order =
        await Order.findById(
          req.params.id
        ).populate(
          "customer",
          "name phone email"
        );

      if (!order) {
        return res.status(404).json({
          message:
            "Order not found",
        });
      }

      const email =
        order.shippingAddress?.email ||
        order.customer?.email;

      if (!email) {
        return res.status(400).json({
          message:
            "This order has no customer email address",
        });
      }

      if (
        !process.env.RESEND_API_KEY
      ) {
        return res.status(503).json({
          message:
            "Email provider is not configured",
        });
      }

      const orderId =
        order._id
          .toString()
          .slice(-8)
          .toUpperCase();

      /*
       * IMPORTANT:
       * The same shared email builder is
       * used for admin + automatic emails.
       */
      const html =
        buildOrderEmailHtml(order);

      const response =
        await fetch(
          "https://api.resend.com/emails",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${process.env.RESEND_API_KEY}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              from:
                process.env.MAIL_FROM ||
                "orders@kashmirclothstores.example",

              to: [email],

              subject:
                `Kashmir Cloth Stores order #${orderId} update`,

              html,
            }),
          }
        );

      if (!response.ok) {
        const providerError =
          await response.text().catch(
            () => ""
          );

        console.error(
          "Resend error:",
          providerError
        );

        return res.status(502).json({
          message:
            "Email provider could not send the message",
        });
      }

      res.json({
        message:
          "Structured order email sent",
      });
    } catch (error) {
      console.error(
        "Send order email error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to send order email",
      });
    }
  }
);


// ============================================================
// CREATE ADMIN / OFFLINE ORDER
// ============================================================

router.post(
  "/orders",
  requireAdmin,
  async (req, res) => {
    const stockAdjustments = [];
    const reservedAdjustments = [];
    let orderPersisted = false;
    let orderStockReserved = false;
    let persistedOrder = null;
    let stockRollbackFailed = false;
    let orderRollbackFailed = false;

    try {
      const {
        customer,
        items,
        paymentMethod = "whatsapp",
        source = "admin",
      } = req.body;

      const normalizedPaymentMethod = String(paymentMethod).trim().toLowerCase();
      const normalizedSource = String(source).trim().toLowerCase();
      const status = req.body.status === undefined
        ? normalizedPaymentMethod === "cod" ? "order_placed" : "payment_confirmed"
        : String(req.body.status).trim().toLowerCase();
      const validPaymentMethods = Order.schema.path("paymentMethod").enumValues;
      const validSources = Order.schema.path("source").enumValues;
      const validStatuses = Order.schema.path("status").enumValues;

      if (!validPaymentMethods.includes(normalizedPaymentMethod)) {
        return res.status(400).json({ message: "Choose a valid payment method." });
      }
      if (!validSources.includes(normalizedSource)) {
        return res.status(400).json({ message: "Choose a valid order source." });
      }
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Choose a valid order status." });
      }

      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (
        !customer ||
        !mongoose.Types.ObjectId.isValid(String(customer.customerId || "")) ||
        ["address", "city", "state", "pinCode"].some(
          (field) => typeof customer[field] !== "string" || !customer[field].trim()
        ) ||
        !Array.isArray(items) ||
        !items.length
      ) {
        return res.status(400).json({
          message:
            "Select a saved customer, enter delivery details, and add at least one item.",
        });
      }

      const savedCustomer = await Customer.findById(customer.customerId);
      if (!savedCustomer) {
        throwOrderError(404, "The selected customer does not exist. Save the customer first, then select them for this order.");
      }
      const phone = normalizeIndianPhone(savedCustomer.phone);
      const email = normalizeCustomerEmail(savedCustomer.email);
      if (!isValidIndianPhone(phone) || (email && !isValidCustomerEmail(email))) {
        throwOrderError(409, "The selected customer has invalid contact details. Update the customer record before creating an order.");
      }


      // --------------------------------------------------------
      // BUILD TRUSTED ORDER ITEMS
      // --------------------------------------------------------

      const trustedItems = [];


      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1) {
          throwOrderError(400, "Item quantities must be whole numbers greater than zero.");
        }


        // ======================================================
        // OFFLINE / MANUAL PRODUCT
        // ======================================================

        if (!item.productId) {
          trustedItems.push({
            productId:
              "offline",

            title:
              String(
                item.title ||
                  "Offline order item"
              ),

            image:
              String(
                item.image || ""
              ),

            quantity,

            price:
              Math.max(
                0,
                Number(item.price) || 0
              ),

            size:
              item.size || "",

            color:
              item.color || "",
          });

          continue;
        }


        // ======================================================
        // LOAD PRODUCT
        // ======================================================

        const product =
          await Product.findById(
            item.productId
          ).select(
            "title slug images price stock soldOut discount variantStock colors sizes"
          );

        if (!product) {
          throwOrderError(404, "Product not found.");
        }


        const selectedSize =
          String(
            item.size || ""
          ).trim();

        const selectedColor =
          String(
            item.color || ""
          ).trim();


        // ======================================================
        // VARIANT PRODUCT
        // ======================================================

        if (
          Array.isArray(
            product.variantStock
          ) &&
          product.variantStock.length > 0
        ) {


          // ----------------------------------------------------
          // SIZE + COLOR ARE REQUIRED
          // ----------------------------------------------------

          if (
            !selectedSize ||
            !selectedColor
          ) {
            throwOrderError(400, `Please select both color and size for ${product.title}.`);
          }


          // ----------------------------------------------------
          // FIND EXACT COLOR + SIZE
          // ----------------------------------------------------

          const variantIndex =
            product.variantStock.findIndex(
              (variant) =>
                String(
                  variant.size || ""
                ).trim() ===
                  selectedSize &&
                String(
                  variant.color || ""
                ).trim() ===
                  selectedColor
            );


          if (variantIndex === -1) {
            throwOrderError(409, `${product.title} does not have ${selectedColor} / ${selectedSize} available.`);
          }


          const variant =
            product.variantStock[
              variantIndex
            ];


          // ----------------------------------------------------
          // CHECK EXACT VARIANT STOCK
          // ----------------------------------------------------

          if (
            Number(
              variant.stock || 0
            ) < quantity
          ) {
            throwOrderError(409, `Only ${Number(variant.stock || 0)} item(s) available for ${selectedColor} / ${selectedSize}.`);
          }


          const colorStock = product.colors?.find((color) => color.name === selectedColor);
          const hasColorStock = colorStock?.stock !== undefined && colorStock?.stock !== null;
          if (
            Number(product.stock || 0) < quantity ||
            (product.colors?.length && !colorStock) ||
            (hasColorStock && Number(colorStock.stock) < quantity)
          ) {
            throwOrderError(409, `Not enough ${selectedColor} / ${selectedSize} stock remains for ${product.title}.`);
          }

          stockAdjustments.push({
            productId: product._id,
            quantity,
            size: selectedSize,
            color: selectedColor,
            variant: true,
            hasColorStock,
            stockAtRead: Number(product.stock || 0),
            title: product.title,
          });

        } else {


          // ====================================================
          // OLD PRODUCT-LEVEL STOCK SYSTEM
          // ====================================================

          const productColor = product.colors?.find((color) => color.name === selectedColor);
          const hasColorStock = productColor?.stock !== undefined && productColor?.stock !== null;
          if (product.colors?.length && !selectedColor) {
            throwOrderError(400, `Please select a color for ${product.title}.`);
          }
          if (product.colors?.length && !productColor) {
            throwOrderError(409, `${product.title} does not have the selected color.`);
          }
          if (
            product.sizes?.length &&
            (!selectedSize || !product.sizes.includes(selectedSize))
          ) {
            throwOrderError(400, `Please select a valid size for ${product.title}.`);
          }
          if (
            Number(product.stock || 0) < quantity ||
            (hasColorStock && Number(productColor.stock) < quantity)
          ) {
            throwOrderError(409, `${product.title} does not have enough stock for the selected options.`);
          }

          stockAdjustments.push({
            productId: product._id,
            quantity,
            color: selectedColor,
            variant: false,
            hasColorStock,
            stockAtRead: Number(product.stock || 0),
            title: product.title,
          });
        }


        // --------------------------------------------------------
        // CALCULATE DISCOUNTED PRICE
        // --------------------------------------------------------

        const discountedPrice =
          Number(
            product.price || 0
          ) *
          (
            1 -
            Math.min(
              99,
              Number(
                product.discount || 0
              )
            ) / 100
          );


        // --------------------------------------------------------
        // SAVE TRUSTED ITEM
        // --------------------------------------------------------

        trustedItems.push({
          productId:
            product._id.toString(),

          slug:
            product.slug,

          title:
            product.title,

          image:
            product.images?.[0] || "",

          quantity,

          price:
            discountedPrice,

          size:
            selectedSize,

          color:
            selectedColor,
        });
      }


      // ========================================================
      // CALCULATE ORDER TOTAL
      // ========================================================

      const total =
        trustedItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.price || 0
            ) *
              Number(
                item.quantity || 0
              ),

          0
        );


      // ========================================================
      // CREATE ORDER
      // ========================================================

      const order = await Order.create({
          customer:
            savedCustomer._id,

          items:
            trustedItems,

          total,

          paymentMethod: normalizedPaymentMethod,

          source: normalizedSource,

          status,

          shippingAddress: {
            name:
              savedCustomer.name,

            phone,

            email:
              email || undefined,

            address:
              customer.address.trim(),

            city:
              customer.city.trim(),

            state:
              customer.state.trim(),

            pinCode:
              String(
                customer.pinCode
              ).trim(),
          },
        });
        persistedOrder = order;
        orderPersisted = true;

      for (const adjustment of stockAdjustments) {
        await reserveManualOrderStock(adjustment);
        reservedAdjustments.push(adjustment);
      }
      orderStockReserved = true;

      // ========================================================
      // SEND ORDER NOTIFICATION
      // ========================================================

      await notifyOrder(
        order,
        "created"
      );


      // ========================================================
      // RESPONSE
      // ========================================================

      res.status(201).json(
        await order.populate(
          "customer",
          "name phone email"
        )
      );

    } catch (error) {
      if (orderPersisted && orderStockReserved) {
        console.error("Admin order follow-up error:", error);
        return res.status(201).json({
          ...persistedOrder.toObject(),
          warning: "The order was saved, but a follow-up step failed. The order is still recorded.",
        });
      }

      for (const adjustment of reservedAdjustments.reverse()) {
        try {
          await rollbackManualOrderStock(adjustment);
        } catch (rollbackError) {
          stockRollbackFailed = true;
          console.error("Admin order stock rollback error:", rollbackError);
        }
      }

      if (orderPersisted && persistedOrder) {
        try {
          await persistedOrder.deleteOne();
        } catch (rollbackError) {
          orderRollbackFailed = true;
          console.error("Admin order rollback error:", rollbackError);
        }
      }

      console.error(
        "Admin order creation error:",
        error
      );

      res.status(stockRollbackFailed || orderRollbackFailed ? 500 : error.status || 400).json({
        message: stockRollbackFailed || orderRollbackFailed
          ? "Order confirmation failed and automatic rollback was incomplete. Check the order and product inventory before retrying."
          : error.message,
      });
    }
  }
);


// ============================================================
// EXPORT
// ============================================================

export default router;