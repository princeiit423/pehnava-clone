import { useEffect, useState } from "react";
import { api } from "../api.js";

const VIEWER_ID_KEY = "kcs_product_viewer_id";
const HEARTBEAT_INTERVAL_MS = 20_000;

function getViewerId() {
  try {
    const savedId = sessionStorage.getItem(VIEWER_ID_KEY);
    if (savedId) return savedId;
    const viewerId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(VIEWER_ID_KEY, viewerId);
    return viewerId;
  } catch (error) {
    console.error("Unable to persist product viewer session:", error);
    return globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function useProductLiveViewers(productId) {
  const [activeViewers, setActiveViewers] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setActiveViewers(null);
    setLoadError(false);
    if (!productId) return undefined;

    let cancelled = false;
    let heartbeatPending = false;
    const viewerId = getViewerId();
    const heartbeat = async () => {
      if (document.visibilityState === "hidden" || heartbeatPending) return;
      heartbeatPending = true;
      try {
        const { data } = await api.post(
          `/products/${encodeURIComponent(productId)}/viewers/heartbeat`,
          { viewerId }
        );
        if (!cancelled && Number.isInteger(data?.activeViewers) && data.activeViewers >= 0) {
          setActiveViewers(data.activeViewers);
          setLoadError(false);
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(true);
        console.error("Failed to refresh live product viewers:", error);
      } finally {
        heartbeatPending = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [productId]);

  return { activeViewers, loadError };
}
