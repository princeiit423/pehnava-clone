import React, { createContext, useContext, useState } from "react";

const RecentlyViewedContext = createContext(null);
const KEY = "kashmir_cloth_stores_recently_viewed";
const MAX = 8;

export function RecentlyViewedProvider({ children }) {
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  });

  function addRecent(productId) {
    setRecent((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(
        0,
        MAX
      );
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <RecentlyViewedContext.Provider value={{ recent, addRecent }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  return useContext(RecentlyViewedContext);
}
