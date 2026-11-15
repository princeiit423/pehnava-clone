import React from "react";
import { Eye } from "lucide-react";

export default function ProductImpressionBadge({ count, className = "" }) {
  if (!Number.isFinite(count)) return null;

  const formattedCount = count.toLocaleString("en-IN");
  return (
    <span
      className={`product-impression-badge ${className}`.trim()}
      aria-label={`${formattedCount} lifetime product impressions`}
      title={`${formattedCount} lifetime product impressions`}
    >
      <Eye size={14} aria-hidden="true" />
      <span>{formattedCount}</span>
    </span>
  );
}
