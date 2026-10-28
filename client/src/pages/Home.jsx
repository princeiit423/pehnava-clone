import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import CategoryStrip from "../components/CategoryStrip.jsx";
import HomeFeatures from "../components/HomeFeatures.jsx";
import { ProductSkeletons } from "../components/LoadingState.jsx";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_HOME_CAROUSELS, getHomeCarouselProducts, getOrderedHomeCarousels } from "../utils/homeCarousels.js";

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
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productLoadError, setProductLoadError] = useState("");
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
  const heroImages = [
    "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788091504/Pehnava-Banner-lawns_xbl4up.webp",
    "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1792681376/Effortless_Elegance_Fashion_Editorial_xyyahu.png",
  ];

  const mobileHeroImages = [
    "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788115734/ratio-mobile-hero_siahdh.png",
    "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788115801/ratio-mobile-hero-2_qbhncd.png",
  ];
  const desktopSlides = homepageContent.heroDesktopImages.length
    ? homepageContent.heroDesktopImages
    : heroImages;
  const mobileSlides = desktopSlides.map((_, index) =>
    homepageContent.heroMobileImages[index]
      || (homepageContent.heroDesktopImages.length ? desktopSlides[index] : mobileHeroImages[index] || desktopSlides[index])
  );

  // =========================
  // HERO IMAGE SLIDER
  // =========================
  useEffect(() => {
    setCurrentHero((index) => index % desktopSlides.length);
  }, [desktopSlides.length]);

  useEffect(() => {
    if (!loadedHeroImages[0]) return undefined;

    const interval = setInterval(() => {
      setCurrentHero((prev) => {
        const next = (prev + 1) % desktopSlides.length;
        return loadedHeroImages[next] ? next : prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [desktopSlides.length, loadedHeroImages]);

  // =========================
  // GET PRODUCTS
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const res = await api.get("/products");

        if (!cancelled) {
          setProducts(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error("Failed to load products:", err);

        if (!cancelled) {
          setProductLoadError("Products could not be loaded. Please refresh and try again.");
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

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
      <section className="hero">
        <Link
          to="/collections/trending"
          className="hero-link"
          aria-label="Shop the New Drop"
        >
          {desktopSlides.map((image, index) => (
            <picture
              className={`hero-slide${index === currentHero ? " is-active" : ""}${loadedHeroImages[index] ? " is-image-ready" : ""}`}
              key={image}
              aria-hidden={index !== currentHero}
            >
              <source
                media="(max-width: 600px)"
                srcSet={optimizeHeroImage(mobileSlides[index] || image, 900)}
              />
              <img
                className="hero-img"
                src={optimizeHeroImage(image, 1920)}
                alt={index === currentHero ? "Shop the New Drop" : ""}
                loading={index === 0 ? "eager" : "lazy"}
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
      {productLoadError && <p className="loading-error home-load-error" role="alert">{productLoadError}</p>}

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
    </main>
  );
}
