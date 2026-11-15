import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { LoadingState, ProductSkeletons } from "../components/LoadingState.jsx";

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      const query = q.trim();

      setLoading(true);
      setError("");
      setResults([]);

      try {
        if (!query) {
          const response = await api.get("/products", { params: { limit: 12 } });
          const initialProducts = Array.isArray(response.data?.products) ? response.data.products : [];
          if (!cancelled) setResults(initialProducts);
          return;
        }

        // First, fetch the actual search results.
        const searchResponse = await api.get(
          `/products?search=${encodeURIComponent(query)}`
        );

        const searchResults = Array.isArray(searchResponse.data)
          ? searchResponse.data
          : [];

        if (cancelled) return;

        if (searchResults.length > 0) {
          setResults(searchResults);
          return;
        }
      } catch (err) {
        console.error("Search failed:", err);

        if (!cancelled) {
          setResults([]);
          setError("Unable to load search results.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <main className="products-section">
      <h2>{q.trim() ? `Search results for "${q}"` : "Explore products"}</h2>

      {loading ? (
        <>
          <LoadingState label="Finding products for you" />
          <div className="product-row grid4 search-skeleton-grid" aria-hidden="true">
            <ProductSkeletons count={8} />
          </div>
        </>
      ) : error ? (
        <p>{error}</p>
      ) : results.length > 0 ? (
        <div className="product-row grid4">
          {results.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      ) : (
        <div className="search-empty">
          <p>{q.trim() ? `No matching or similar products found for "${q}". Try another search or browse a collection.` : "Browse our collections to find your next look."}</p>
          <nav className="search-collection-links" aria-label="Browse collections">
            <Link to="/collections/trending">New Arrivals</Link>
            <Link to="/collections/stitched-wear">Tees & Polos</Link>
            <Link to="/collections/daily-wear">Everyday Shirts</Link>
            <Link to="/">Home</Link>
          </nav>
        </div>
      )}
    </main>
  );
}
