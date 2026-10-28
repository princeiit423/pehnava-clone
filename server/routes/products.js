import express from "express";
import Product from "../models/Product.js";
import { requireAdmin } from "../middleware/auth.js";

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

function toProductResponse(product) {
  const item = product.toObject();
  item.stock = availableStock(item);
  item.soldOut = item.stock <= 0;
  item.salePrice = item.price * (1 - Math.min(99, item.discount || 0) / 100);
  return item;
}

export function normalizeProductPayload(payload) {
  const body = { ...payload };
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
    const q = {};
    if (category) q.categories = category;
    if (color) q["colors.name"] = color;
    if (dupatta) q.dupatta = dupatta;
    if (minPrice || maxPrice) {
      q.price = {};
      if (minPrice) q.price.$gte = Number(minPrice);
      if (maxPrice) q.price.$lte = Number(maxPrice);
    }
    if (search) q.$text = { $search: search };
    if (ids) q._id = { $in: ids.split(",") };

    const products = (await Product.find(q).sort({ createdAt: -1 })).map(toProductResponse);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:slug
router.get("/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(toProductResponse(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
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
