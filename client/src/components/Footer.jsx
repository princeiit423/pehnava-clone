import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "../categories.js";
import { api } from "../api.js";

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
  const description = footer.description ?? "Beautiful Sarees, Lehenga, stitched & unstitched Suits for Women. Shirting & Suiting, Coat-Pant, Kurta and Sherwani Fabrics for Men.";
  const address = footer.address ?? "Main Road Phusro Bazar, Bokaro, Jharkhand, India";
  const instagramUrl = footer.instagramUrl || "https://www.instagram.com/kashmirclothstores/";

  return (
    <footer>
      {/* BRAND */}
      <div className="footer-brand">
        <div className="logo">
          KASHMIR
          <small>CLOTH STORES</small>
        </div>

        <p className="footer-description">{description}</p>
        <p><b>Address:</b> {address}</p>

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
      <div>
        <h4>FOLLOW</h4>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
        >
          Instagram
        </a>
        {(footer.links || []).map((link, index) => (
          /^https?:\/\//i.test(link.url)
            ? <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            : <Link key={`${link.url}-${index}`} to={link.url}>{link.label}</Link>
        ))}
      </div>
    </footer>
  );
}