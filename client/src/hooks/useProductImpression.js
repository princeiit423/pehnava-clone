import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export function useProductImpression(productId) {
  const targetRef = useRef(null);
  const reportedProductId = useRef(null);
  const [impressionCount, setImpressionCount] = useState(null);

  useEffect(() => {
    const target = targetRef.current;
    setImpressionCount(null);
    if (!productId || !target || reportedProductId.current === productId) return undefined;

    const recordImpression = () => {
      if (reportedProductId.current === productId) return;
      reportedProductId.current = productId;
      api.post(`/products/${encodeURIComponent(productId)}/impression`)
        .then(({ data }) => {
          if (Number.isFinite(data?.impressionCount)) setImpressionCount(data.impressionCount);
        })
        .catch((error) => {
          reportedProductId.current = null;
          console.error("Failed to record product impression:", error);
        });
    };

    if (typeof IntersectionObserver === "undefined") {
      recordImpression();
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
        observer.disconnect();
        recordImpression();
      }
    }, { threshold: 0.5 });

    observer.observe(target);
    return () => observer.disconnect();
  }, [productId]);

  return { targetRef, impressionCount };
}
