import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { changeCartItemSize } from "../utils/cartItems.js";

const CartContext = createContext(null);
const KEY = "kashmir_cloth_stores_cart";

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item
      && typeof item.productId === "string"
      && item.productId.length > 0
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && item.quantity <= 20
    ).map((item) => ({
      ...item,
      color: typeof item.color === "string" ? item.color : "",
      size: typeof item.size === "string" ? item.size : "",
      key: `${item.productId}::${item.color || ""}::${item.size || ""}`,
    }));
  } catch (error) {
    console.error("Unable to read the saved cart:", error);
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readCart);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Unable to save the cart:", error);
    }
  }, [cart]);

  useEffect(() => {
    function syncCart(event) {
      if (event.key === KEY) setCart(readCart());
    }
    window.addEventListener("storage", syncCart);
    return () => window.removeEventListener("storage", syncCart);
  }, []);

  function addToCart(item) {
    if (!item || typeof item.productId !== "string" || !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error("This product or quantity cannot be added to your cart.");
    }
    const color = typeof item.color === "string" ? item.color : "";
    const size = typeof item.size === "string" ? item.size : "";
    const key = `${item.productId}::${color}::${size}`;
    const existing = cart.find((entry) => entry.key === key);
    if (existing && existing.quantity + item.quantity > 20) {
      throw new Error("You can add up to 20 of this product option.");
    }
    if (!existing && cart.length >= 30) {
      throw new Error("Your cart can contain up to 30 different product options.");
    }
    if (existing) {
      setCart(cart.map((entry) => entry.key === key
        ? { ...entry, ...item, color, size, key, quantity: entry.quantity + item.quantity }
        : entry));
    } else {
      setCart([...cart, { ...item, color, size, key }]);
    }
  }

  function updateQuantity(key, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity } : item));
  }

  function changeSize(key, size) {
    setCart(changeCartItemSize(cart, key, size));
  }

  function removeFromCart(key) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  function removeItems(items) {
    const purchasedQuantities = new Map();
    for (const item of items) {
      const key = `${item.productId}::${item.color || ""}::${item.size || ""}`;
      purchasedQuantities.set(key, (purchasedQuantities.get(key) || 0) + item.quantity);
    }
    setCart((current) => current.flatMap((item) => {
      const purchasedQuantity = purchasedQuantities.get(item.key) || 0;
      if (!purchasedQuantity) return [item];
      purchasedQuantities.set(item.key, Math.max(0, purchasedQuantity - item.quantity));
      const remainingQuantity = item.quantity - purchasedQuantity;
      return remainingQuantity > 0 ? [{ ...item, quantity: remainingQuantity }] : [];
    }));
  }

  function clearCart() {
    setCart([]);
  }

  const itemCount = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);

  return (
    <CartContext.Provider value={{ cart, itemCount, addToCart, updateQuantity, changeSize, removeFromCart, removeItems, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
