import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import CategoryStrip from "../components/CategoryStrip.jsx";
import HomeFeatures from "../components/HomeFeatures.jsx";
import { TrustHighlights } from "../components/TrustHighlights.jsx";
import { LoadingState, ProductSkeletons } from "../components/LoadingState.jsx";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_HOME_CAROUSELS, getHomeCarouselProducts, getOrderedHomeCarousels } from "../utils/homeCarousels.js";
import { parseHomepageImageList } from "../utils/homepageImageList.js";
import { useProductPages } from "../hooks/useProductPages.js";

function optimizeHeroImage(url, width) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  const uploadPath = "/image/upload/";
  const uploadIndex = url.indexOf(uploadPath);
  const afterUpload = url.slice(uploadIndex + uploadPath.length);
  if (/^(?:f_[^/]+|q_[^/]+|w_\d+|c_[^/]+)\//.test(afterUpload)) return url;

  return `${url.slice(0, uploadIndex + uploadPath.length)}f_auto,q_auto,w_${width},c_limit/${afterUpload}`;
}

export default function Home() {
  const {
    products,
    loading: loadingProducts,
    loadingMore,
    hasMore,
    error: productLoadError,
    pageError,
    loadMore,
    retryFirstPage,
    sentinelRef,
    supportsAutoLoad,
  } = useProductPages(50);
  const [currentHero, setCurrentHero] = useState(0);
  const [loadedHeroImages, setLoadedHeroImages] = useState([]);
  const [homepageContent, setHomepageContent] = useState({
    heroDesktopImages: [],
    heroMobileImages: [],
    categoryImages: [],
    showroomImages: [],
    influencerPicks: [],
    instagramPosts: [],
    reviews: [],
  });
  const [storefrontSettings, setStorefrontSettings] = useState(null);
  const carouselRefs = useRef({});

  useEffect(() => {
    api.get("/storefront-settings")
      .then(({ data }) => setStorefrontSettings(data))
      .catch((error) => console.error("Failed to load storefront settings:", error));
  }, []);

  // =========================
  // HERO IMAGES
  // =========================
  const configuredDesktopSlides = parseHomepageImageList(homepageContent.heroDesktopImages);
  const configuredMobileSlides = parseHomepageImageList(homepageContent.heroMobileImages);
  const desktopSlides = configuredDesktopSlides;
  const mobileSlides = desktopSlides.map((image, index) => configuredMobileSlides[index] || image);

  // =========================
  // HERO IMAGE SLIDER
  // =========================
  useEffect(() => {
    setCurrentHero((index) => desktopSlides.length ? index % desktopSlides.length : 0);
  }, [desktopSlides.length]);

  useEffect(() => {
    if (desktopSlides.length < 2) return undefined;

    const interval = setInterval(() => {
      setCurrentHero((prev) => {
        return (prev + 1) % desktopSlides.length;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [desktopSlides.length]);

  useEffect(() => {
    let cancelled = false;

    api.get("/homepage-content")
      .then((res) => {
        if (!cancelled) {
          setHomepageContent({
            heroDesktopImages: res.data.heroDesktopImages || [],
            heroMobileImages: res.data.heroMobileImages || [],
            categoryImages: res.data.categoryImages || [],
            showroomImages: res.data.showroomImages || [],
            influencerPicks: res.data.influencerPicks || [],
            instagramPosts: res.data.instagramPosts || [],
            reviews: res.data.reviews || [],
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load homepage content:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================
  // GENERIC CAROUSEL SCROLL
  // =========================
  const scrollCarousel = (element, direction) => {
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth,
      behavior: "smooth",
    });
  };

  function renderProducts(items) {
    if (loadingProducts) return <ProductSkeletons count={5} />;
    return items.map((product) => (
      <ProductCard key={product._id} product={product} showBuyNow={false} />
    ));
  }

  return (
    <main>
      {/* =========================
          HERO
      ========================= */}
      {desktopSlides.length > 0 && (
        <section className="hero">
          <Link
            to="/collections/trending"
            className="hero-link"
            aria-label="Shop RacoonBro everyday essentials"
          >
            {desktopSlides.map((image, index) => (
              <picture
                className={`hero-slide${index === currentHero ? " is-active" : ""}${loadedHeroImages[index] ? " is-image-ready" : ""}`}
                key={`${image}-${index}`}
                aria-hidden={index !== currentHero}
              >
                <source
                  media="(max-width: 600px)"
                  srcSet={optimizeHeroImage(mobileSlides[index] || image, 900)}
                />
                <img
                  className="hero-img"
                  src={optimizeHeroImage(image, 1920)}
                  alt={index === currentHero ? "RacoonBro everyday clothing" : ""}
                  loading={index === currentHero || index === (currentHero + 1) % desktopSlides.length ? "eager" : "lazy"}
                  fetchPriority={index === currentHero ? "high" : "low"}
                  decoding="async"
                  onLoad={() => setLoadedHeroImages((loaded) => {
                    const next = [...loaded];
                    next[index] = true;
                    return next;
                  })}
                />
              </picture>
            ))}
          </Link>
        </section>
      )}
      {productLoadError && <p className="loading-error home-load-error" role="alert">
        Products could not be loaded. <button type="button" onClick={retryFirstPage}>Retry</button>
      </p>}
      <TrustHighlights />

      {/* =========================
          OUR CATEGORY
      ========================= */}
      <CategoryStrip categoryImages={homepageContent.categoryImages} categories={storefrontSettings ? storefrontSettings.categories || [] : null} />

      {getOrderedHomeCarousels(storefrontSettings?.homeCarousels || DEFAULT_HOME_CAROUSELS)
        .map((section) => {
          const sectionProducts = getHomeCarouselProducts(products, section);
          const sectionTitle = section.title || "Featured products";
          return (
            <section className="products-section" key={section.id}>
              <div className="section-head">
                <h2>{sectionTitle}</h2>
                {section.collectionSlug && <Link to={`/collections/${section.collectionSlug}`}>View all</Link>}
              </div>
              <div className="product-carousel">
                <button
                  type="button"
                  className="carousel-arrow carousel-left"
                  onClick={() => scrollCarousel(carouselRefs.current[section.id], -1)}
                  aria-label={`Previous ${sectionTitle} products`}
                >
                  <ChevronLeft size={21} strokeWidth={2} aria-hidden="true" />
                </button>
                <div
                  className="product-row"
                  ref={(element) => { carouselRefs.current[section.id] = element; }}
                  aria-busy={loadingProducts}
                >
                  {renderProducts(sectionProducts)}
                </div>
                <button
                  type="button"
                  className="carousel-arrow carousel-right"
                  onClick={() => scrollCarousel(carouselRefs.current[section.id], 1)}
                  aria-label={`Next ${sectionTitle} products`}
                >
                  <ChevronRight size={21} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </section>
          );
        })}

      <HomeFeatures products={products} content={homepageContent} storefrontSettings={storefrontSettings} showShowroom />
      {pageError && <p className="loading-error home-load-error" role="alert">More products could not be loaded. <button type="button" onClick={loadMore}>Retry</button></p>}
      {loadingMore && <LoadingState label="Loading more products" />}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
      {hasMore && !loadingMore && !supportsAutoLoad && <button type="button" onClick={loadMore}>Load more products</button>}
    </main>
  );
}
