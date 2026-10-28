import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  image: { type: String, default: "" },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  size: { type: String, default: "" },
  color: { type: String, default: "" },
}, { _id: false });

const paymentFeedbackSchema = new mongoose.Schema({
  outcome: { type: String, enum: ["exited", "failed"], required: true },
  reason: {
    type: String,
    enum: ["payment_method", "technical_issue", "changed_mind", "need_help", "other"],
    required: true,
  },
  details: { type: String, trim: true, maxlength: 500, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const paymentIntentSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  items: { type: [itemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  amountPaise: { type: Number, required: true, min: 1 },
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
  },
  razorpayOrderId: { type: String, required: true, unique: true },
  paymentId: String,
  status: { type: String, enum: ["initiated", "verified", "processing", "completed"], default: "initiated" },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  feedback: { type: [paymentFeedbackSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("PaymentIntent", paymentIntentSchema);
