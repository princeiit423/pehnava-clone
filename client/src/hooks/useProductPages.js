import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export function useProductPages(pageSize = 24) {
  const [products, setProducts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pageError, setPageError] = useState(null);
  const sentinelRef = useRef(null);
  const requestVersion = useRef(0);
  const loadingMoreRef = useRef(false);
  const loadingAllRef = useRef(false);

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    loadingMoreRef.current = false;
    setProducts([]);
    setNextCursor(null);
    setError(null);
    setPageError(null);
    setLoading(true);

    api.get("/products", { params: { limit: pageSize } })
      .then(({ data }) => {
        if (requestVersion.current !== version) return;
        setProducts(Array.isArray(data?.products) ? data.products : []);
        setNextCursor(data?.nextCursor || null);
      })
      .catch((requestError) => {
        if (requestVersion.current === version) setError(requestError);
      })
      .finally(() => {
        if (requestVersion.current === version) setLoading(false);
      });

    return () => {
      if (requestVersion.current === version) requestVersion.current += 1;
    };
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || loadingAllRef.current) return;

    const version = requestVersion.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const { data } = await api.get("/products", {
        params: { limit: pageSize, cursor: nextCursor },
      });
      if (requestVersion.current !== version) return;
      const nextProducts = Array.isArray(data?.products) ? data.products : [];
      setProducts((current) => [...current, ...nextProducts]);
      setNextCursor(data?.nextCursor || null);
    } catch (requestError) {
      if (requestVersion.current === version) setPageError(requestError);
    } finally {
      if (requestVersion.current === version) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [nextCursor, pageSize]);

  const loadAll = useCallback(async () => {
    if (!nextCursor || loadingAllRef.current) return;

    const version = requestVersion.current + 1;
    requestVersion.current = version;
    loadingAllRef.current = true;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const { data } = await api.get("/products");
      if (requestVersion.current !== version) return;
      setProducts(Array.isArray(data) ? data : []);
      setNextCursor(null);
    } catch (requestError) {
      if (requestVersion.current === version) setPageError(requestError);
    } finally {
      if (requestVersion.current === version) {
        loadingAllRef.current = false;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [nextCursor]);

  useEffect(() => {
    if (!nextCursor || pageError || loadingMore || !sentinelRef.current || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, loadingMore, nextCursor, pageError]);

  const retryFirstPage = useCallback(() => {
    setError(null);
    setLoading(true);
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    api.get("/products", { params: { limit: pageSize } })
      .then(({ data }) => {
        if (requestVersion.current !== version) return;
        setProducts(Array.isArray(data?.products) ? data.products : []);
        setNextCursor(data?.nextCursor || null);
      })
      .catch((requestError) => {
        if (requestVersion.current === version) setError(requestError);
      })
      .finally(() => {
        if (requestVersion.current === version) setLoading(false);
      });
  }, [pageSize]);

  return {
    products,
    loading,
    loadingMore,
    hasMore: Boolean(nextCursor),
    error,
    pageError,
    loadMore,
    loadAll,
    retryFirstPage,
    sentinelRef,
    supportsAutoLoad: typeof IntersectionObserver !== "undefined",
  };
}
