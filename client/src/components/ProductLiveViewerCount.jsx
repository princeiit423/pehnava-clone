import React from "react";
import { Eye } from "lucide-react";
import { useProductLiveViewers } from "../hooks/useProductLiveViewers.js";

export default function ProductLiveViewerCount({ productId }) {
  const { activeViewers, loadError } = useProductLiveViewers(productId);

  if (activeViewers === null) {
    return loadError
      ? <p className="product-live-viewers product-live-viewers-error">Live viewer count unavailable</p>
      : null;
  }

  return (
    <p
      className="product-live-viewers"
      aria-label={`${activeViewers} ${activeViewers === 1 ? "person is" : "people are"} viewing this product now`}
      aria-live="off"
    >
      <Eye size={14} aria-hidden="true" />
      <strong>{activeViewers.toLocaleString("en-IN")}</strong>
      <span>{activeViewers === 1 ? "person is viewing this product now" : "people are viewing this product now"}</span>
    </p>
  );
}
