import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "../categories.js";
import { api } from "../api.js";
import { FooterPaymentMethods, FooterTrustHighlights } from "./TrustHighlights.jsx";

export default function Footer() {
  const [storefront, setStorefront] = useState(null);
  useEffect(() => {
    api.get("/storefront-settings")
      .then(({ data }) => setStorefront(data))
      .catch((error) => console.error("Failed to load storefront footer settings:", error));
  }, []);
  const categories = storefront
    ? (storefront.categories || []).filter((category) => category.active !== false && category.type !== "price")
    : CATEGORIES;
  const footer = storefront?.footer || {};
  const description = footer.description ?? "Everyday clothing for men: comfortable tees, easy shirts, dependable bottoms and versatile layers.";
  const address = footer.address ?? "";
  const instagramUrl = footer.instagramUrl || "";

  return (
    <footer>
      <FooterTrustHighlights />
      <FooterPaymentMethods />

      {/* BRAND */}
      <div className="footer-brand">
        <div className="logo">
          <img className="brand-logo-image footer-logo-image" src="/Logos/RacoonBro_primary_logo.png" alt="RacoonBro — Wear the Attitude" />
        </div>

        <p className="footer-description">{description}</p>
        {address && <p><b>Address:</b> {address}</p>}

      </div>

      {/* SHOP */}
      <div>
        <h4>SHOP</h4>

        {categories.slice(0, 4).map((c) => (
          <Link
            key={c.slug}
            to={`/collections/${c.slug}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* HELP */}
      <div>
        <h4>HELP</h4>

        <Link to="/shipping-and-delivery-policy">
          Shipping & Delivery
        </Link>

        <Link to="/refund-policy">
          Return / Refund
        </Link>

        <Link to="/frequently-asked-questions">
          Frequently Asked Questions
        </Link>

        <Link to="/contact">Contact support</Link>
        <a href={`mailto:${storefront?.contact?.email || "racoonbro777@gmail.com"}`}>
          {storefront?.contact?.email || "racoonbro777@gmail.com"}
        </a>
      </div>

      {/* ABOUT */}
      <div>
        <h4>ABOUT</h4>

        <Link to="/our-story">
          Our Story
        </Link>

        <Link to="/contact">
          Contact Us
        </Link>
      </div>

      {/* FOLLOW */}
      {(instagramUrl || footer.links?.length > 0) && <div>
        <h4>FOLLOW</h4>

        {instagramUrl && <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
        {(footer.links || []).map((link, index) => (
          /^https?:\/\//i.test(link.url)
            ? <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            : <Link key={`${link.url}-${index}`} to={link.url}>{link.label}</Link>
        ))}
      </div>}
    </footer>
  );
}