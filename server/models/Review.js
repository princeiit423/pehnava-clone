import mongoose from "mongoose";

const reviewImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 100 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    images: { type: [reviewImageSchema], default: [] },
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, product: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
