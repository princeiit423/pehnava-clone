import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 3, maxlength: 32 },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0.01 },
  minimumOrderAmount: { type: Number, min: 0, default: 0 },
  maximumDiscount: { type: Number, min: 0.01, default: null },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ active: 1, startsAt: 1, expiresAt: 1 });

export default mongoose.model("Coupon", couponSchema);
