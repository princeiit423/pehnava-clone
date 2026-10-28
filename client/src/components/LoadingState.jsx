import React from "react";

export function LoadingState({ label = "Loading" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ProductSkeletons({ count = 4 }) {
  return (
    <>
      <span className="visually-hidden" role="status">Loading products</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="product product-skeleton" key={index} aria-hidden="true">
          <span className="product-skeleton-image" />
          <span className="product-skeleton-line product-skeleton-title" />
          <span className="product-skeleton-line product-skeleton-price" />
        </div>
      ))}
    </>
  );
}
