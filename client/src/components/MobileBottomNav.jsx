import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ClipboardList, Heart, House, Search, Sparkles } from "lucide-react";
import { useLikes } from "../context/LikesContext.jsx";

const items = [
  { label: "Home", to: "/", icon: House, end: true },
  { label: "Search", to: "/search", icon: Search },
  { label: "New Drop", to: "/collections/trending", icon: Sparkles },
  { label: "Wishlist", to: "/likes", icon: Heart },
  { label: "Your Orders", to: "/account", icon: ClipboardList },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const { likes } = useLikes();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      {items.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-bottom-nav-link${isActive ? " is-active" : ""}`}
          aria-label={label === "Wishlist" && likes.length ? `${label}, ${likes.length} saved items` : label}
        >
          <span className="mobile-bottom-nav-icon">
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            {label === "Wishlist" && likes.length > 0 && (
              <span className="mobile-bottom-nav-count">{likes.length > 99 ? "99+" : likes.length}</span>
            )}
          </span>
          <span className="mobile-bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
