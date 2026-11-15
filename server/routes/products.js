import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductViewerPresence from "../models/ProductViewerPresence.js";
import StorefrontSettings from "../models/StorefrontSettings.js";
import { requireAdmin } from "../middleware/auth.js";
import { buildProductSearchQuery, rankProductsBySearch } from "../utils/productSearch.js";
import {
  getProductViewerExpiry,
  hashProductViewerId,
  normalizeProductViewerId,
} from "../utils/productViewers.js";
import {
  decodeProductCursor,
  encodeProductCursor,
  parseProductPageSize,
} from "../utils/productPagination.js";

const router = express.Router();

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeVariantInventory(variants = []) {
  const seen = new Set();
  return variants.map((variant) => {
    const size = String(variant.size || "").trim();
    const color = String(variant.color || "").trim();
    const stock = Number(variant.stock ?? 0);
    const key = `${color.toLowerCase()}::${size.toLowerCase()}`;
    if (!size || !color) throw new Error("Every inventory row needs a color and size");
    if (seen.has(key)) throw new Error(`Duplicate inventory variant: ${color} + ${size}`);
    if (!Number.isInteger(stock) || stock < 0) throw new Error(`Quantity for ${color} + ${size} must be a whole non-negative number`);
    seen.add(key);
    return { size, color, stock };
  });
}

function availableStock(product) {
  if (
    product.variantStock?.length &&
    product.variantStock.every((variant) => variant.stock !== undefined && variant.stock !== null)
  ) {
    return product.variantStock.reduce((total, variant) => total + Math.max(0, Number(variant.stock) || 0), 0);
  }
  if (
    product.colors?.length &&
    product.colors.every((color) => color.stock !== undefined && color.stock !== null)
  ) {
    return product.colors.reduce((total, color) => total + Math.max(0, Number(color.stock) || 0), 0);
  }
  return Math.max(0, Number(product.stock) || 0);
}

export function toProductResponse(product, includeImpressionCount = false) {
  const item = typeof product.toObject === "function" ? product.toObject() : { ...product };
  if (!includeImpressionCount) delete item.impressionCount;
  item.stock = availableStock(item);
  item.soldOut = item.stock <= 0;
  item.salePrice = item.price * (1 - Math.min(99, item.discount || 0) / 100);
  return item;
}

async function impressionTrackingEnabled() {
  const settings = await StorefrontSettings.findOne({ key: "storefront" })
    .select("impressionTrackingEnabled")
    .lean();
  return settings?.impressionTrackingEnabled === true;
}

export function normalizeProductPayload(payload) {
  const body = { ...payload };
  delete body.impressionCount;
  if (body.codEligible !== undefined && typeof body.codEligible !== "boolean") {
    throw new Error("COD eligibility must be enabled or disabled");
  }
  if (Array.isArray(body.variantStock) && body.variantStock.length) {
    body.variantStock = normalizeVariantInventory(body.variantStock);
    body.sizes = [...new Set(body.variantStock.map((variant) => variant.size))];
  }
  if (Array.isArray(body.colors)) {
    const colorNames = new Set();
    body.colors = body.colors.map((color) => {
      const name = String(color.name || "").trim();
      const key = name.toLowerCase();
      const stock = Number(color.stock ?? 1);
      if (!name || colorNames.has(key)) throw new Error(`Duplicate color: ${name}`);
      if (!Number.isInteger(stock) || stock < 0) throw new Error(`Quantity for ${name} must be a whole non-negative number`);
      colorNames.add(key);
      return { ...color, name, stock, images: Array.isArray(color.images) ? color.images : [] };
    });
    if (body.variantStock?.length) {
      const canonicalColors = new Map(body.colors.map((color) => [color.name.toLowerCase(), color.name]));
      if (body.variantStock.some((variant) => !canonicalColors.has(variant.color.toLowerCase()))) {
        throw new Error("Every size quantity must reference a color that exists on this product");
      }
      body.variantStock = body.variantStock.map((variant) => ({
        ...variant,
        color: canonicalColors.get(variant.color.toLowerCase()),
      }));
      body.colors = body.colors.map((color) => ({
        ...color,
        stock: body.variantStock.some((variant) => variant.color === color.name)
          ? body.variantStock.filter((variant) => variant.color === color.name).reduce((total, variant) => total + variant.stock, 0)
          : color.stock,
      }));
    }
    if (!body.variantStock?.length && body.colors.length) {
      body.stock = body.colors.reduce((total, color) => total + color.stock, 0);
    } else if (body.variantStock?.length && body.colors.length) {
      body.stock = body.colors.reduce((total, color) => total + color.stock, 0);
    } else if (body.variantStock?.length) {
      throw new Error("Add each variant color to the product before assigning size quantities");
    }
  } else if (body.variantStock?.length) {
    throw new Error("Add each variant color to the product before assigning size quantities");
  }
  if (body.stock !== undefined && !body.variantStock?.length && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) {
    throw new Error("Product stock must be a whole non-negative number");
  }
  if (body.stock !== undefined && !Number.isInteger(Number(body.stock))) {
    throw new Error("Product stock must be a whole non-negative number");
  }
  body.soldOut = Number(body.stock) <= 0;
  return body;
}

// GET /api/products  -> list with filters
router.get("/", async (req, res) => {
  try {
    const { category, minPrice, maxPrice, color, dupatta, search, ids } =
      req.query;
    const isPaginated = req.query.limit !== undefined;
    if (!isPaginated && req.query.cursor !== undefined) {
      return res.status(400).json({ message: "A product cursor requires a page limit" });
    }
    let pageSize;
    let cursor;
    if (isPaginated) {
      try {
        pageSize = parseProductPageSize(req.query.limit);
        cursor = req.query.cursor === undefined ? null : decodeProductCursor(req.query.cursor);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      if (search !== undefined) {
        return res.status(400).json({ message: "Product search does not support cursor pagination" });
      }
    }

    const q = {};
    if (category) q.categories = category;
    if (color) q["colors.name"] = color;
    if (dupatta) q.dupatta = dupatta;
    if (minPrice || maxPrice) {
      q.price = {};
      if (minPrice) q.price.$gte = Number(minPrice);
      if (maxPrice) q.price.$lte = Number(maxPrice);
    }
    if (ids) q._id = { $in: ids.split(",") };

    let foundProducts;
    if (search !== undefined) {
      const searchText = typeof search === "string" ? search.trim() : "";
      if (searchText.length > 100) {
        return res.status(400).json({ message: "Search must be 100 characters or fewer" });
      }
      const searchQuery = buildProductSearchQuery(searchText);
      if (!searchQuery) return res.json([]);

      foundProducts = await Product.find({ ...q, ...searchQuery });
      if (!foundProducts.length) {
        foundProducts = rankProductsBySearch(await Product.find(q), searchText);
      } else {
        foundProducts = rankProductsBySearch(foundProducts, searchText);
      }
    } else {
      if (isPaginated) {
        const pageQuery = cursor
          ? { $and: [q, {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
            ],
          }] }
          : q;
        const listingFields = [
          "title", "slug", "sku", "price", "discount", "impressionCount", "stock",
          "images", "type", "fabric", "fit", "occasion", "dupatta",
          "colors.name", "colors.hex", "colors.stock", "colors.images", "sizes", "variantStock",
          "categories", "codEligible", "soldOut", "isNew", "createdAt",
        ].join(" ");
        foundProducts = await Product.find(pageQuery)
          .select(listingFields)
          .sort({ createdAt: -1, _id: -1 })
          .limit(pageSize + 1)
          .lean();
      } else {
        foundProducts = await Product.find(q).sort({ createdAt: -1 });
      }
    }

    const showImpressions = await impressionTrackingEnabled();
    if (isPaginated) {
      const hasMore = foundProducts.length > pageSize;
      const page = foundProducts.slice(0, pageSize);
      res.json({
        products: page.map((product) => toProductResponse(product, showImpressions)),
        nextCursor: hasMore ? encodeProductCursor(page[page.length - 1]) : null,
      });
      return;
    }
    res.json(foundProducts.map((product) => toProductResponse(product, showImpressions)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/admin/impressions (admin)
router.get("/admin/impressions", requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({})
      .select("title slug impressionCount")
      .sort({ impressionCount: -1, title: 1 })
      .lean();
    res.json(products.map((product) => ({
      _id: product._id,
      title: product.title,
      slug: product.slug,
      impressionCount: product.impressionCount || 0,
    })));
  } catch (error) {
    console.error("Get product impressions error:", error);
    res.status(500).json({ message: "Failed to load product impressions." });
  }
});

// GET /api/products/:slug
router.get("/:slug", async (req, res) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug });
    if (!product && mongoose.isValidObjectId(req.params.slug)) {
      product = await Product.findById(req.params.slug);
    }
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(toProductResponse(product, await impressionTrackingEnabled()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products/:id/impression
router.post("/:id/impression", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    if (!await impressionTrackingEnabled()) return res.sendStatus(204);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { impressionCount: 1 } },
      { new: true }
    ).select("_id impressionCount");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ impressionCount: product.impressionCount || 0 });
  } catch (error) {
    console.error("Record product impression error:", error);
    res.status(500).json({ message: "Failed to record product impression." });
  }
});

// POST /api/products/:id/viewers/heartbeat
router.post("/:id/viewers/heartbeat", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const viewerId = normalizeProductViewerId(req.body?.viewerId);
    const now = new Date();
    const expiresAt = getProductViewerExpiry(now.getTime());
    const productId = new mongoose.Types.ObjectId(req.params.id);
    const viewerHash = hashProductViewerId(viewerId);
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) return res.status(404).json({ message: "Product not found" });

    await ProductViewerPresence.findOneAndUpdate(
      { productId, viewerHash },
      {
        $set: { lastSeenAt: now, expiresAt },
        $setOnInsert: { productId, viewerHash },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const activeViewers = await ProductViewerPresence.countDocuments({
      productId,
      expiresAt: { $gt: now },
    });
    res.json({ activeViewers });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("Update product viewer presence error:", error);
    res.status(500).json({ message: "Unable to update live product viewers." });
  }
});

// PATCH /api/products/:id/cod-eligibility (admin)
router.patch("/:id/cod-eligibility", requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }
  const { codEligible } = req.body || {};
  if (typeof codEligible !== "boolean") {
    return res.status(400).json({ message: "COD eligibility must be enabled or disabled" });
  }

  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { codEligible } },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(toProductResponse(product));
  } catch (err) {
    res.status(400).json({ message: err.message || "Unable to update COD eligibility" });
  }
});

// POST /api/products (admin)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const body = normalizeProductPayload(req.body);
    const slug = body.slug ? slugify(body.slug) : slugify(body.title);
    const product = await Product.create({ ...body, slug, soldOut: Number(body.stock) <= 0 });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/products/:id (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const body = normalizeProductPayload(req.body);
    if (body.title && !body.slug) body.slug = slugify(body.title);
    if (body.stock !== undefined) body.soldOut = Number(body.stock) <= 0;
    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
    });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/products/:id (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
