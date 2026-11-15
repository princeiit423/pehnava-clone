import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const LikesContext = createContext(null);
const KEY = "kashmir_cloth_stores_likes";

function readLocalLikes() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(saved)
      ? [...new Set(saved.filter((id) => typeof id === "string"))].slice(0, 500)
      : [];
  } catch {
    return [];
  }
}

export function LikesProvider({ children }) {
  const [likes, setLikes] = useState(readLocalLikes);
  const authGeneration = useRef(0);
  const wasAuthenticated = useRef(Boolean(localStorage.getItem("kcs_customer_token")));

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(likes));
  }, [likes]);

  useEffect(() => {
    let active = true;

    async function syncWishlist() {
      const generation = ++authGeneration.current;
      if (!localStorage.getItem("kcs_customer_token")) {
        if (wasAuthenticated.current) setLikes([]);
        wasAuthenticated.current = false;
        return;
      }
      wasAuthenticated.current = true;

      const guestLikes = readLocalLikes();
      try {
        const { data } = await api.get("/customers/me");
        if (!active || generation !== authGeneration.current) return;
        const accountLikes = Array.isArray(data.wishlist) ? data.wishlist : [];
        const mergedLikes = [...new Set([...accountLikes, ...guestLikes])].slice(0, 500);
        const result = mergedLikes.length === accountLikes.length
          ? { data: { wishlist: accountLikes } }
          : await api.put("/customers/me/wishlist", { productIds: mergedLikes });
        if (active && generation === authGeneration.current) {
          setLikes(Array.isArray(result.data.wishlist) ? result.data.wishlist : []);
        }
      } catch (error) {
        if (active && generation === authGeneration.current) {
          console.error("Unable to sync customer wishlist:", error);
        }
      }
    }

    window.addEventListener("customer-auth-changed", syncWishlist);
    window.addEventListener("storage", syncWishlist);
    syncWishlist();
    return () => {
      active = false;
      authGeneration.current += 1;
      window.removeEventListener("customer-auth-changed", syncWishlist);
      window.removeEventListener("storage", syncWishlist);
    };
  }, []);

  async function toggleLike(productId) {
    const normalizedId = String(productId);
    const liked = !likes.includes(normalizedId);
    if (localStorage.getItem("kcs_customer_token")) {
      const { data } = await api.patch("/customers/me/wishlist", {
        productId: normalizedId,
        liked,
      });
      setLikes(Array.isArray(data.wishlist) ? data.wishlist : []);
      return;
    }
    setLikes((previous) => previous.includes(normalizedId)
      ? previous.filter((id) => id !== normalizedId)
      : [...previous, normalizedId].slice(-500));
  }

  function isLiked(productId) {
    return likes.includes(productId);
  }

  return (
    <LikesContext.Provider value={{ likes, toggleLike, isLiked }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  return useContext(LikesContext);
}
