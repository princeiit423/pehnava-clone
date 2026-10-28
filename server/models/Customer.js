import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  marketingConsent: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Customer", customerSchema);