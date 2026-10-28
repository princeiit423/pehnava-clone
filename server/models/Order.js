import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
  items: [{ productId: String, slug: String, title: String, image: String, quantity: Number, price: Number, size: String, color: String }],
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["cod", "phonepe", "razorpay", "phonepe-manual", "razorpay-manual", "instagram", "whatsapp"], required: true },
  source: { type: String, enum: ["website", "whatsapp", "instagram", "admin"], default: "website" },
  paymentId: String,
  status: { type: String, enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "order_placed", "payment_confirmed", "processing_packed", "out_for_delivery", "cancelled_refund"], default: "order_placed" },
  trackingNumber: String,
  carrier: String,
  editedAt: Date,
  editedBy: String,
  stockRestoredAt: Date,
  review: {
    rating: { type: Number, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000 },
    submittedAt: Date,
  },
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
  },
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);