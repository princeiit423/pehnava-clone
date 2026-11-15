import mongoose from "mongoose";

const productViewerPresenceSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  viewerHash: { type: String, required: true },
  lastSeenAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

productViewerPresenceSchema.index({ productId: 1, viewerHash: 1 }, { unique: true });
productViewerPresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("ProductViewerPresence", productViewerPresenceSchema);
