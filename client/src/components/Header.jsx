import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES } from "../categories.js";
import { useLikes } from "../context/LikesContext.jsx";
import { Heart, Moon, Search, ShoppingBag, Sun } from "lucide-react";
import { api } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

const defaultAnnouncements = [
  "Free shipping on all orders across India",
  "Questions about an order? Email racoonbro777@gmail.com",
  "RacoonBro — everyday essentials, on repeat.",
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [storefront, setStorefront] = useState(null);
  const { likes } = useLikes();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeAction = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  function closeMenu() {
    setMenuOpen(false);
  }

  function onSearchSubmit(e) {
    e.preventDefault();

    const query = search.trim();

    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      closeMenu();
    }
  }

  // Close the mobile menu with the Escape key.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && menuOpen) {
        closeMenu();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Prevent the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    if (!menuOpen) {
      document.body.classList.remove("menu-open");
      return;
    }

    document.body.classList.add("menu-open");

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  const announcementMessages = storefront ? (storefront.announcements || []) : defaultAnnouncements;
  const categories = storefront
    ? (storefront.categories || []).filter((category) => category.active !== false)
    : CATEGORIES;
  const desktopOrder = ["trending", "stitched-wear", "daily-wear", "party-wear", "festive-wear", "luxe", "save-more"];
  const mainLinks = categories
    .filter((category) => category.type !== "price")
    .sort((a, b) => {
      const aIndex = desktopOrder.indexOf(a.slug);
      const bIndex = desktopOrder.indexOf(b.slug);
      return (aIndex < 0 ? desktopOrder.length : aIndex) - (bIndex < 0 ? desktopOrder.length : bIndex);
    });
  const budgetCategories = categories.filter((category) => category.type === "price");

  useEffect(() => {
    api.get("/storefront-settings")
      .then(({ data }) => setStorefront(data))
      .catch((error) => console.error("Failed to load storefront navigation settings:", error));
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (announcementMessages.length < 2) return;

    const interval = window.setInterval(() => {
      setAnnouncementIndex((index) => (index + 1) % announcementMessages.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [announcementMessages.length]);

  return (
    <header className={menuOpen ? "menu-open" : ""}>
      {announcementMessages.length > 0 && <div className="announcement" aria-label="Store announcements">
        <p className="announcement-text" key={announcementIndex}>
          {announcementMessages[announcementIndex % announcementMessages.length]}
        </p>
      </div>}

      <div className="top-header">
        <button
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "×" : "☰"}
        </button>

        <Link to="/" className="logo nav-brand" aria-label="RacoonBro home" onClick={closeMenu}>
          <img className="nav-brand-logo" src="/Logos/RacoonBro_primary_logo.png" alt="RacoonBro — Wear the Attitude" />
        </Link>

        <nav>
          {mainLinks.slice(0, 3).map((category) => <Link key={category.slug} to={`/collections/${category.slug}`}>{category.label}</Link>)}

          <div className="nav-dropdown">
            <span>By Budget</span>

            <div className="dropdown-menu">
              {budgetCategories.map((category) => (
                <Link key={category.slug} to={`/collections/${category.slug}`}>
                  {category.label}
                </Link>
              ))}
            </div>
          </div>

          {mainLinks.slice(3).map((category) => <Link key={category.slug} to={`/collections/${category.slug}`}>{category.label}</Link>)}
        </nav>

        <div className="actions">
          <form className="search-bar" onSubmit={onSearchSubmit}>
            <input
              className="search-box"
              placeholder="Search the store"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the store"
            />

            <button type="submit" aria-label="Search">
              <Search size={18} strokeWidth={2} />
            </button>
          </form>

          <Link to="/likes" className="wishlist-btn" title="My Wishlist" aria-label={`My Wishlist${likes.length ? `, ${likes.length} saved products` : ""}`}>
            <Heart className="wishlist-icon" size={20} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            {likes.length > 0 && <sup>{likes.length}</sup>}
          </Link>
          <Link to="/cart" className="cart-header-link" aria-label={`Shopping cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`} title="Shopping cart">
            <ShoppingBag size={19} strokeWidth={1.8} />
            {itemCount > 0 && <sup>{itemCount > 99 ? "99+" : itemCount}</sup>}
          </Link>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={themeAction} aria-pressed={theme === "dark"} title={themeAction}>
            <ThemeIcon size={18} aria-hidden="true" />
          </button>
          <Link to="/account" className="account-link">My Dashboard</Link>
        </div>
      </div>

      {menuOpen && (
        <div
          className="mobile-menu-backdrop"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}

      <aside
        id="mobile-navigation"
        className="mobile-nav"
        aria-hidden={!menuOpen}
        aria-label="Mobile navigation"
      >
        <div className="mobile-nav-header">
          <h3 className="mobile-nav-title">Menu</h3>

          <button
            className="mobile-nav-close"
            type="button"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            ×
          </button>
        </div>

        {categories.map((c) => (
          <Link
            key={c.slug}
            to={`/collections/${c.slug}`}
            onClick={closeMenu}
          >
            {c.label}
          </Link>
        ))}
        <Link to="/account" onClick={closeMenu}>
          My Dashboard
        </Link>
        <Link to="/cart" onClick={closeMenu}>
          Shopping cart {itemCount > 0 ? `(${itemCount})` : ""}
        </Link>
        <button className="theme-toggle mobile-theme-toggle" type="button" onClick={toggleTheme} aria-label={themeAction} aria-pressed={theme === "dark"}>
          <ThemeIcon size={18} aria-hidden="true" />
          <span className="theme-toggle-label">{themeAction}</span>
        </button>
      </aside>
    </header>
  );
}
