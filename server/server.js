import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import productRoutes from "./routes/products.js";
import adminRoutes from "./routes/admin.js";
import customerRoutes from "./routes/customers.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import homepageContentRoutes from "./routes/homepageContent.js";
import storefrontSettingsRoutes from "./routes/storefrontSettings.js";
import reviewRoutes from "./routes/reviews.js";
import couponRoutes from "./routes/coupons.js";
import Customer from "./models/Customer.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { removeLegacyOrderNumberIndex } from "./utils/orderIndexes.js";

dotenv.config();

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error("Missing required environment variables: MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0) {
  console.error("TRUST_PROXY_HOPS must be a non-negative integer");
  process.exit(1);
}
app.set("trust proxy", trustedProxyHops);
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://checkout.razorpay.com; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://kashmirclothstores.vercel.app",
  ...(process.env.CLIENT_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  allowedHeaders: ["Content-Type", "Authorization", "X-Customer-Authorization"],
  credentials: false
}));

app.use("/api", apiRateLimiter);
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/homepage-content", homepageContentRoutes);
app.use("/api", storefrontSettingsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/coupons", couponRoutes);

app.get("/", (req, res) => res.send("RacoonBro API is running"));
app.use((error, req, res, next) => {
  console.error("Unhandled API request error:", error);
  if (res.headersSent) return next(error);
  res.status(Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500)
    .json({ message: error.status >= 400 && error.status < 500 ? error.message : "Unexpected server error" });
});

const PORT = process.env.PORT || 5000;

async function updateLegacyProductTitles() {
  const legacyProducts = await Product.find({ title: /^GhostFreak\b/ }).select("_id title").lean();
  if (!legacyProducts.length) return;

  const result = await Product.bulkWrite(legacyProducts.map(({ _id, title }) => ({
    updateOne: {
      filter: { _id, title },
      update: { $set: { title: title.replace(/^GhostFreak\b/, "RacoonBro") } },
    },
  })));
  if (result.modifiedCount) {
    console.log(`Updated ${result.modifiedCount} legacy product title(s) to RacoonBro`);
  }
}

mongoose
  .connect(process.env.MONGODB_URI, { maxPoolSize: 10, minPoolSize: 0 })
  .then(async () => {
    console.log("MongoDB Atlas connected");
    await updateLegacyProductTitles();
    const removedLegacyOrderIndex = await removeLegacyOrderNumberIndex(
      mongoose.connection.db,
      Order.collection.collectionName
    );
    if (removedLegacyOrderIndex) {
      console.warn("Removed obsolete unique orderNumber index from orders collection");
    }
    Customer.collection.dropIndex("email_1").catch(() => {});
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing server or set another PORT in .env.`);
      } else {
        console.error("Server listen error:", error.message);
      }
      mongoose.disconnect().finally(() => process.exit(1));
    });
  })
  .catch((err) => {
    console.error("MongoDB startup error:", err.message);
    process.exit(1);
  });
