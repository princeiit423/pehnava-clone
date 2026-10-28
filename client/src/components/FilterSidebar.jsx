import React, { useMemo } from "react";
import { CATEGORIES } from "../categories.js";
import { Link } from "react-router-dom";

export default function FilterSidebar({
  products,
  filters,
  setFilters,
  category,
  mobileOpen,
  onClose,
  categories,
}) {
  const hasActiveFilters = Boolean(filters.minPrice || filters.maxPrice || filters.color || filters.dupatta);
  const colors = useMemo(() => {
    const map = new Map();

    products.forEach((p) =>
      p.colors?.forEach(
        (c) => !map.has(c.name) && map.set(c.name, c.hex)
      )
    );

    return Array.from(map.entries());
  }, [products]);

  const dupattas = useMemo(() => {
    const map = new Map();

    products.forEach((p) => {
      if (p.dupatta) {
        map.set(p.dupatta, (map.get(p.dupatta) || 0) + 1);
      }
    });

    return Array.from(map.entries());
  }, [products]);

  function toggleColor(name) {
    setFilters((f) => ({
      ...f,
      color: f.color === name ? "" : name,
    }));
  }

  function toggleDupatta(name) {
    setFilters((f) => ({
      ...f,
      dupatta: f.dupatta === name ? "" : name,
    }));
  }

  return (
   <aside className={`filter-sidebar ${mobileOpen ? "filter-open" : ""}`}>
  
  {/* MOBILE FILTER HEADER */}
  <div className="mobile-filter-header">
    <h3>Filter</h3>
    <button type="button" onClick={onClose} aria-label="Close filter">
      ×
    </button>
  </div>

  {/* SCROLLABLE BODY — yeh wrapper add karo */}
  <div className="filter-scroll-body">
    {hasActiveFilters && (
      <button
        type="button"
        className="clear-filters-inline"
        onClick={() => setFilters({ minPrice: "", maxPrice: "", color: "", dupatta: "" })}
      >
        Clear all filters
      </button>
    )}

    {/* CATEGORIES */}
    <div className="filter-block">
      <h4>CATEGORIES</h4>
      {(categories || CATEGORIES).map((c) => (
        <Link
          key={c.slug}
          to={`/collections/${c.slug}`}
          className={c.slug === category ? "active" : ""}
          onClick={onClose}
        >
          {c.label}
        </Link>
      ))}
    </div>

    {/* PRICE */}
    <div className="filter-block">
      <h4>PRICE</h4>
      <div className="price-inputs">
        <input
          type="number"
          placeholder="₹ Min"
          value={filters.minPrice}
          onChange={(e) =>
            setFilters((f) => ({ ...f, minPrice: e.target.value }))
          }
        />
        <span>to</span>
        <input
          type="number"
          placeholder="₹ Max"
          value={filters.maxPrice}
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxPrice: e.target.value }))
          }
        />
      </div>
    </div>

    {colors.length > 0 && (
      <div className="filter-block">
        <h4>COLOR</h4>
        <div className="color-palette">
          {colors.map(([name, hex]) => (
            <button
            type="button"
            key={name}
            title={name}
            aria-label={`Filter by ${name}`}
            aria-pressed={filters.color === name}
            onClick={() => toggleColor(name)}
            className={`swatch big ${filters.color === name ? "selected" : ""}`}
            style={{ background: hex }}
            />
          ))}
        </div>
      </div>
    )}

    {dupattas.length > 0 && (
      <div className="filter-block">
        <h4>DUPATTA</h4>
        {dupattas.map(([name, count]) => (
          <label key={name} className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.dupatta === name}
              onChange={() => toggleDupatta(name)}
            />
            {name} ({count})
          </label>
        ))}
      </div>
    )}

  </div>{/* filter-scroll-body end */}

</aside>
  );
}