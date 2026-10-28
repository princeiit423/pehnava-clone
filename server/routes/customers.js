import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Customer from "../models/Customer.js";
import { requireCustomer } from "../middleware/auth.js";
import { isValidCustomerEmail, isValidIndianPhone, normalizeCustomerEmail, normalizeIndianPhone } from "../utils/customerValidation.js";

const router = express.Router();
const tokenFor = (customer) => jwt.sign({ sub: customer._id.toString(), role: "customer", phone: customer.phone }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password, marketingConsent = false } = req.body;
    if (!name || !phone || !email || !password || password.length < 8) return res.status(400).json({ message: "Name, a valid phone number, email address and an 8 character password are required." });
    const normalizedPhone = normalizeIndianPhone(phone);
    const normalizedEmail = normalizeCustomerEmail(email);
    if (!isValidIndianPhone(normalizedPhone)) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });
    if (!isValidCustomerEmail(normalizedEmail)) return res.status(400).json({ message: "Enter a valid email address." });
    if (await Customer.exists({ phone: normalizedPhone })) return res.status(409).json({ message: "An account already exists for this phone number" });
    const customer = await Customer.create({ name: name.trim(), phone: normalizedPhone, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), marketingConsent: Boolean(marketingConsent) });
    res.status(201).json({ token: tokenFor(customer), customer: { id: customer._id, name: customer.name, phone: customer.phone, email: customer.email, marketingConsent: customer.marketingConsent } });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post("/login", async (req, res) => {
  const identifier = String(req.body.identifier || req.body.phone || "").trim();
  const normalizedPhone = identifier.replace(/[\s-]/g, "");
  const customer = await Customer.findOne({
    $or: [{ phone: normalizedPhone }, { email: identifier.toLowerCase() }],
  });
  if (!customer || !(await bcrypt.compare(req.body.password || "", customer.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
  res.json({ token: tokenFor(customer), customer: { id: customer._id, name: customer.name, phone: customer.phone, email: customer.email, marketingConsent: customer.marketingConsent } });
});

router.get("/me", requireCustomer, async (req, res) => res.json(await Customer.findById(req.user.sub).select("name phone email marketingConsent createdAt")));
export default router;