import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import FilterSidebar from "../components/FilterSidebar.jsx";
import { LoadingState, ProductSkeletons } from "../components/LoadingState.jsx";
import { getCategoryConfig } from "../categories.js";

export default function Collection() {
  const { slug } = useParams();

  const [all, setAll] = useState([]);
  const [storefrontCategories, setStorefrontCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    color: "",
    dupatta: "",
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const config = storefrontCategories
    ? storefrontCategories.find((category) => category.slug === slug && category.active !== false)
    : getCategoryConfig(slug);

  useEffect(() => {
    let cancelled = false;
    api.get("/storefront-settings")
      .then((res) => {
        if (!cancelled && Array.isArray(res.data?.categories)) {
          setStorefrontCategories(res.data.categories);
        }
      })
      .catch((error) => {
        console.error("Failed to load storefront categories:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    api.get("/products")
      .then((res) => {
        if (!cancelled) setAll(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => {
        console.error("Failed to load collection products:", error);
        if (!cancelled) setLoadError("Products could not be loaded. Please refresh and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const baseFiltered = useMemo(() => {
    if (!config) return [];

    if (config.type === "tag") {
      const productTag = config.productTag || config.tag;
      if (!productTag) return [];
      return all.filter((p) =>
        p.categories?.includes(productTag)
      );
    }

    if (config.type === "price") {
      const min = config.min ?? config.minPrice;
      const max = config.max ?? config.maxPrice;
      return all.filter(
        (p) =>
          (min == null || p.price >= Number(min)) &&
          (max == null || p.price <= Number(max))
      );
    }

    return all;
  }, [all, config, storefrontCategories]);

  const filtered = useMemo(() => {
    const result = baseFiltered.filter((p) => {
      if (
        filters.minPrice &&
        p.price < Number(filters.minPrice)
      ) {
        return false;
      }

      if (
        filters.maxPrice &&
        p.price > Number(filters.maxPrice)
      ) {
        return false;
      }

      if (
        filters.color &&
        !p.colors?.some(
          (c) => c.name === filters.color
        )
      ) {
        return false;
      }

      if (
        filters.dupatta &&
        p.dupatta !== filters.dupatta
      ) {
        return false;
      }

      return true;
    });
    return [...result].sort((left, right) => {
      if (sortBy === "price-asc") return Number(left.price) - Number(right.price);
      if (sortBy === "price-desc") return Number(right.price) - Number(left.price);
      if (sortBy === "name-asc") return String(left.title).localeCompare(String(right.title), undefined, { sensitivity: "base" });
      if (sortBy === "name-desc") return String(right.title).localeCompare(String(left.title), undefined, { sensitivity: "base" });
      return 0;
    });
  }, [baseFiltered, filters, sortBy]);
return (
  <main className="collection-page">

    <div className="breadcrumb">
      <Link to="/">Home</Link> &gt;{" "}
      <span>{config?.label || slug}</span>
    </div>

    <h1 className="collection-title">
      {config?.label || slug}
    </h1>

    {/* MOBILE FILTER BUTTON */}
    <button
      type="button"
      className="mobile-filter-btn"
      onClick={() => setFilterOpen(true)}
    >
      <span>☰</span>
      Filter
    </button>

    {/* DARK BACKDROP */}
    {filterOpen && (
      <div
        className="filter-backdrop"
        onClick={() => setFilterOpen(false)}
      />
    )}

    <div className="collection-layout">

      <FilterSidebar
        products={baseFiltered}
        filters={filters}
        setFilters={setFilters}
        category={slug}
        mobileOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        categories={storefrontCategories?.filter((category) => category.active !== false)}
      />

      <div className="collection-results">
      {!loading && !loadError && <div className="collection-toolbar">
        <span>{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>
        <label>Sort by
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to high</option>
            <option value="price-desc">Price: High to low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
          </select>
        </label>
      </div>}
      <div className="product-row grid4" aria-busy={loading}>
        {loading ? (
          <>
            <LoadingState label="Loading collection" />
            <ProductSkeletons count={8} />
          </>
        ) : loadError ? (
          <p className="loading-error" role="alert">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p>No products match these filters yet.</p>
        ) : filtered.map((p) => (
          <ProductCard
            key={p._id}
            product={p}
          />
        ))}
      </div>
      </div>

    </div>
  </main>
);
}