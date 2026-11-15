import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Headphones,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import "./TrustHighlights.css";

const HOME_HIGHLIGHTS = [
  {
    icon: MapPinned,
    title: "Free shipping across India",
    detail: "No shipping charge at checkout.",
    href: "/shipping-and-delivery-policy",
  },
  {
    icon: ShieldCheck,
    title: "Secure Razorpay checkout",
    detail: "We don't store card or UPI credentials.",
    href: "/frequently-asked-questions",
  },
  {
    icon: PackageCheck,
    title: "Follow your order",
    detail: "Check delivery progress in your account.",
    href: "/account",
  },
  {
    icon: BadgeCheck,
    title: "Know our policy first",
    detail: "Request a return or exchange within 7 days of delivery.",
    href: "/refund-policy",
  },
];

export function TrustHighlights() {
  return (
    <section className="trust-highlights" aria-label="Shopping information">
      {HOME_HIGHLIGHTS.map(({ icon: Icon, title, detail, href }) => (
        <Link className="trust-highlight" to={href} key={title}>
          <span className="trust-highlight-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
          <span className="trust-highlight-copy">
            <strong>{title}</strong>
            <span>{detail}</span>
          </span>
          <ArrowUpRight className="trust-highlight-arrow" size={15} aria-hidden="true" />
        </Link>
      ))}
    </section>
  );
}

const FOOTER_HIGHLIGHTS = [
  {
    icon: Banknote,
    title: "Cash on delivery",
    detail: "Available on eligible products.",
    href: "/frequently-asked-questions",
  },
  {
    icon: RefreshCw,
    title: "7-day return or exchange requests",
    detail: "Submit within 7 days of delivery; every request is reviewed.",
    href: "/refund-policy",
  },
  {
    icon: Truck,
    title: "Free shipping across India",
    detail: "Estimated delivery in 2–7 business days after payment confirmation.",
    href: "/shipping-and-delivery-policy",
  },
  {
    icon: LockKeyhole,
    title: "Secure online payments",
    detail: "Pay using Razorpay's supported payment methods.",
    href: "/frequently-asked-questions",
  },
];

export function FooterTrustHighlights() {
  return (
    <section className="footer-trust-highlights" aria-labelledby="footer-trust-heading">
      <div className="footer-trust-heading">
        <p>THE RACCOONBRO PROMISE</p>
        <h3 id="footer-trust-heading">Shop with confidence</h3>
        <span>Helpful details, clear policies, and support when you need it.</span>
      </div>
      <div className="footer-trust-grid">
        {FOOTER_HIGHLIGHTS.map(({ icon: Icon, title, detail, href }) => (
          <Link className="footer-trust-highlight" to={href} key={title}>
            <span className="footer-trust-highlight-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
            <span className="footer-trust-highlight-copy">
              <strong>{title}</strong>
              <span>{detail}</span>
            </span>
            <ArrowUpRight className="footer-trust-highlight-arrow" size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const PAYMENT_METHODS = [
  ["PhonePe", "phonepe"],
  ["Google Pay", "google-pay"],
  ["Visa", "visa"],
  ["Mastercard", "mastercard"],
  ["RuPay", "rupay"],
  ["UPI", "upi"],
  ["Paytm", "paytm"],
];

export function FooterPaymentMethods() {
  return (
    <section className="footer-payment-methods" aria-labelledby="footer-payment-heading">
      <div className="footer-payment-copy">
        <h3 id="footer-payment-heading">Secure payment options</h3>
        <p>Choose a convenient payment method at checkout.</p>
      </div>
      <ul className="footer-payment-list">
        {PAYMENT_METHODS.map(([name, image]) => (
          <li className={`footer-payment-logo footer-payment-logo-${image}`} key={name}>
            <img src={`/payment-methods/${image}.png`} alt={name} loading="lazy" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductPurchaseDetails({ codEligible = true }) {
  return (
    <aside className="product-purchase-details" aria-label="Delivery, payment, and returns">
      <div>
        <Banknote size={17} aria-hidden="true" />
        <p>
          <strong>{codEligible ? "Cash on delivery available" : "Online payment required"}</strong>
          <span>{codEligible ? "Pay when your order arrives." : "COD is not available for this product."}</span>
        </p>
      </div>
      <div>
        <Truck size={17} aria-hidden="true" />
        <p><strong>Free shipping across India</strong><span>Estimated delivery in 2–7 business days after payment confirmation.</span></p>
      </div>
      <div>
        <RefreshCw size={17} aria-hidden="true" />
        <p><strong>7-day return or exchange requests</strong><span>Requests are reviewed by our team.</span></p>
      </div>
      <div>
        <ShieldCheck size={17} aria-hidden="true" />
        <p><strong>Secure online payment</strong><span>Checkout through Razorpay.</span></p>
      </div>
      <div className="product-purchase-help">
        <Headphones size={17} aria-hidden="true" />
        <p><strong>Need help?</strong><Link to="/contact">Contact our team</Link></p>
      </div>
      <p className="purchase-policy-note">
        Return or exchange requests must be submitted within 7 days of delivery and are reviewed according to our policy.{" "}
        <Link to="/refund-policy">Read the full policy</Link>
      </p>
    </aside>
  );
}
