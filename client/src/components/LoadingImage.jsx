import React, { useState } from "react";

export default function LoadingImage({
  src,
  fallbackSources = [],
  alt = "",
  className = "",
  loading = "lazy",
  onClick,
  ...imageProps
}) {
  const sources = [src, ...fallbackSources].filter((source, index, all) =>
    Boolean(source) && all.indexOf(source) === index
  );
  const [imageState, setImageState] = useState({ src: null, index: 0, status: "loading" });
  const index = imageState.src === src ? imageState.index : 0;
  const status = imageState.src === src ? imageState.status : "loading";
  const activeSource = sources[index];

  function handleError() {
    const nextIndex = index + 1;
    setImageState({
      src,
      index: nextIndex,
      status: nextIndex < sources.length ? "loading" : "error",
    });
  }

  return (
    <span
      className={`loading-image-shell ${status === "loaded" ? "is-loaded" : ""} ${status === "error" ? "has-error" : ""} ${className}`}
      onClick={onClick}
      aria-busy={status === "loading"}
    >
      {status === "loading" && <span className="image-skeleton-shimmer" aria-hidden="true" />}
      {!activeSource || status === "error" ? (
        <span className="image-load-error" role="img" aria-label={alt || "Image unavailable"}>
          Image unavailable
        </span>
      ) : (
        <img
          {...imageProps}
          key={activeSource}
          src={activeSource}
          alt={alt}
          loading={loading}
          className="loading-image"
          onLoad={() => setImageState({ src, index, status: "loaded" })}
          onError={handleError}
        />
      )}
    </span>
  );
}
