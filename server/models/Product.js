import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
  { name: String, hex: String, images: { type: [String], default: [] }, stock: { type: Number, min: 0, default: 1 } },
  { _id: false }
);

const variantStockSchema = new mongoose.Schema(
  { size: String, color: String, stock: { type: Number, min: 0, default: 1 } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, min: 0, max: 99, default: 0 },
    stock: { type: Number, min: 0, default: 1 },
    images: { type: [String], default: [] },
    type: { type: String, default: "Stitched/Ready to Wear" },
    fabric: { type: String, default: "Cotton" },
    dupatta: { type: String, default: "Cotton" },
    colors: { type: [colorSchema], default: [] },
    sizes: { type: [String], default: ["Free Size"] },
    variantStock: { type: [variantStockSchema], default: [] },
    categories: { type: [String], default: [] },
    soldOut: { type: Boolean, default: false },
    isNew: { type: Boolean, default: true },
    description: { type: String, default: "" },
    careGuide: { type: String, default: "Dry wash only." },
    shipping: {
      type: String,
      default: "Free shipping all over India. Dispatched in 3-5 days.",
    },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

productSchema.index({ title: "text", sku: "text" });

export default mongoose.model("Product", productSchema);
