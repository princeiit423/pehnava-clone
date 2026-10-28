import React, { createContext, useContext, useEffect, useState } from "react";

const LikesContext = createContext(null);
const KEY = "kashmir_cloth_stores_likes";

export function LikesProvider({ children }) {
  const [likes, setLikes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(likes));
  }, [likes]);

  function toggleLike(productId) {
    setLikes((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
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
