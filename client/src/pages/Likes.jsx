import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLikes } from "../context/LikesContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { LoadingState, ProductSkeletons } from "../components/LoadingState.jsx";

export default function Likes() {
  const { likes } = useLikes();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    if (likes.length === 0) {
      setProducts([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    api.get(`/products?ids=${likes.join(",")}`)
      .then((res) => {
        if (!cancelled) setProducts(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => {
        console.error("Failed to load liked products:", error);
        if (!cancelled) setLoadError("Liked products could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [likes]);

  return (
    <main className="products-section">
      <h2>My Liked Products</h2>
      {loading && <LoadingState label="Loading your liked products" />}
      {loadError && <p className="loading-error" role="alert">{loadError}</p>}
      {!loading && !loadError && products.length === 0 && <p>You haven't liked any products yet.</p>}
      <div className="product-row grid4" aria-busy={loading}>
        {loading ? <ProductSkeletons count={8} /> : products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </main>
  );
}
