import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Heart, House, LayoutDashboard, Search, ShoppingBag } from "lucide-react";
import { useLikes } from "../context/LikesContext.jsx";
import { useCart } from "../context/CartContext.jsx";

const items = [
  { label: "Home", to: "/", icon: House, end: true },
  { label: "Search", to: "/search", icon: Search },
  { label: "Cart", to: "/cart", icon: ShoppingBag },
  { label: "Wishlist", to: "/likes", icon: Heart },
  { label: "Dashboard", to: "/account", icon: LayoutDashboard },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const { likes } = useLikes();
  const { itemCount } = useCart();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      {items.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-bottom-nav-link${isActive ? " is-active" : ""}`}
          aria-label={label === "Wishlist" && likes.length ? `${label}, ${likes.length} saved items` : label === "Cart" && itemCount ? `Cart, ${itemCount} items` : label === "Dashboard" ? "Your account dashboard and orders" : label}
        >
          <span className="mobile-bottom-nav-icon">
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            {label === "Wishlist" && likes.length > 0 && (
              <span className="mobile-bottom-nav-count">{likes.length > 99 ? "99+" : likes.length}</span>
            )}
            {label === "Cart" && itemCount > 0 && (
              <span className="mobile-bottom-nav-count">{itemCount > 99 ? "99+" : itemCount}</span>
            )}
          </span>
          <span className="mobile-bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
