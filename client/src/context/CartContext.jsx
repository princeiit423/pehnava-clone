import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const KEY = "kashmir_cloth_stores_cart";

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)); }, [cart]);

  function addToCart(item) {
    const key = `${item.productId}::${item.color || ""}::${item.size || ""}`;
    setCart((current) => {
      const existing = current.find((entry) => entry.key === key);
      if (existing) return current.map((entry) => entry.key === key ? { ...entry, quantity: entry.quantity + item.quantity } : entry);
      return [...current, { ...item, key }];
    });
  }

  return <CartContext.Provider value={{ cart, addToCart }}>{children}</CartContext.Provider>;
}

export function useCart() { return useContext(CartContext); }
