import mongoose from "mongoose";

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 100, required: true },
  phone: { type: String, trim: true, required: true },
  email: { type: String, lowercase: true, trim: true, maxlength: 254, default: "" },
  address: { type: String, trim: true, maxlength: 250, required: true },
  city: { type: String, trim: true, maxlength: 80, required: true },
  state: { type: String, trim: true, maxlength: 80, required: true },
  pinCode: { type: String, trim: true, required: true },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  marketingConsent: { type: Boolean, default: false },
  shippingAddress: { type: shippingAddressSchema, default: undefined },
  wishlist: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model("Customer", customerSchema);