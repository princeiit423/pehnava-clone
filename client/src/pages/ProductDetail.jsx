import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLikes } from "../context/LikesContext.jsx";
import { useRecentlyViewed } from "../context/RecentlyViewedContext.jsx";
import { useToast } from "../components/Toast.jsx";
import ProductCard from "../components/ProductCard.jsx";
import HomeFeatures from "../components/HomeFeatures.jsx";
import LoadingImage from "../components/LoadingImage.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { startCheckout } from "../utils/checkout.js";
import { getRelatedProduct } from "../utils/productRecommendations.js";
import { Heart, Share2, Minus, Plus, ChevronRight } from "lucide-react";
import "./ProductRecommendations.css";

export default function ProductDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [tab, setTab] = useState("description");
  const [productReviews, setProductReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewLoadError, setReviewLoadError] = useState("");
  const [relatedProduct, setRelatedProduct] = useState(null);
  const [homepageContent, setHomepageContent] = useState({
    influencerPicks: [],
    instagramPosts: [],
    reviews: [],
  });
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loadError, setLoadError] = useState("");
  const { isLiked, toggleLike } = useLikes();
  const { addRecent } = useRecentlyViewed();
  const showToast = useToast();

  function firstAvailableSize(productData, colorName) {
    if (productData.variantStock?.length) {
      return productData.sizes?.find((size) => productData.variantStock.some((variant) => variant.color === colorName && variant.size === size && variant.stock > 0)) || "";
    }
    return productData.sizes?.find(() => (productData.stock || 0) > 0) || "";
  }

  useEffect(() => {
    setProduct(null);
    setLoadError("");
    api.get(`/products/${slug}`).then((res) => {
      setProduct(res.data);
      setActiveImg(0);
      const requestedColor = searchParams.get("color");
      const matchingColor = res.data.colors?.find((color) => color.name === requestedColor);
      const firstColor = matchingColor?.name || res.data.colors?.find((color) => (res.data.variantStock?.length ? res.data.variantStock.some((variant) => variant.color === color.name && variant.stock > 0) : color.stock > 0))?.name || "";
      setSelectedColor(firstColor);
      setSelectedSize(firstAvailableSize(res.data, firstColor));
      setQuantity(1);
      addRecent(res.data._id);
    }).catch(() => setLoadError("This product could not be loaded. Please try again."));
    // eslint-disable-next-line
  }, [slug, searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadingReviews(true);
    setReviewLoadError("");
    api.get(`/reviews/products/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (!cancelled) setProductReviews(response.data);
      })
      .catch((error) => {
        if (cancelled) return;
        setProductReviews([]);
        setReviewLoadError(error.response?.data?.message || "Customer reviews could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoadingReviews(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setRelatedProduct(null);
    if (!product) return undefined;

    api.get("/products")
      .then((response) => {
        if (cancelled) return;
        const products = Array.isArray(response.data) ? response.data : [];
        setRelatedProduct(getRelatedProduct(products, product));
      })
      .catch((error) => {
        console.error("Failed to load related products:", error);
        if (!cancelled) setRelatedProduct(null);
      });

    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    let cancelled = false;

    api.get("/homepage-content")
      .then((res) => {
        if (!cancelled) {
          setHomepageContent({
            influencerPicks: res.data.influencerPicks || [],
            instagramPosts: res.data.instagramPosts || [],
            reviews: res.data.reviews || [],
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load homepage social content:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedColor || !product) return;
    const nextVariant = product.variantStock?.find((variant) => variant.color === selectedColor && variant.size === selectedSize);
    if (product.variantStock?.length && (!nextVariant || nextVariant.stock <= 0)) setSelectedSize(firstAvailableSize(product, selectedColor));
    setQuantity(1);
  }, [selectedColor, product]);

  if (!product) {
    return (
      <main className="product-detail product-detail-loading">
        {loadError ? <p className="loading-error" role="alert">{loadError}</p> : <LoadingState label="Loading product details" />}
      </main>
    );
  }

  const liked = isLiked(product._id);
  const selectedVariant = product.variantStock?.find((variant) => variant.size === selectedSize && variant.color === selectedColor);
  const availableStock = product.variantStock?.length
    ? selectedVariant?.stock ?? 0
    : (selectedColor ? product.colors?.find((color) => color.name === selectedColor)?.stock : product.stock) ?? 0;
  const isUnavailable = product.soldOut || availableStock <= 0;

  function selectColor(color) {
    setSelectedColor(color.name);
    setSelectedSize(firstAvailableSize(product, color.name));
    setActiveImg(0);
  }

  const selectedColorImages = product.colors?.find((color) => color.name === selectedColor)?.images?.filter(Boolean) || [];
  const galleryImages = selectedColorImages.length ? selectedColorImages : product.images || [];
  const activeImage = galleryImages[activeImg] || product.images?.[0];
  const averageReviewRating = productReviews.length
    ? productReviews.reduce((total, review) => total + review.rating, 0) / productReviews.length
    : 0;

  function handleBuyNow() {
    startCheckout(navigate, {
      productId: product._id,
      title: product.title,
      image: activeImage || "",
      price: Number(product.salePrice ?? product.price * (1 - (product.discount || 0) / 100)),
      quantity,
      size: selectedSize,
      color: selectedColor,
    });
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: product.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      showToast("Product link copied!");
    }
  }

  return (
    <main className="product-detail">
      <div className="breadcrumb">
        <Link to="/">Home</Link> &gt; <Link to="/collections/stitched-wear">Stitched Wear</Link> &gt;{" "}
        <span>{product.title}</span>
      </div>

      <div className="pd-layout">
        <div className="pd-gallery">
          <div className="pd-main-img">
            {product.soldOut && <span className="badge sold-out">SOLD OUT</span>}
            <LoadingImage
              key={activeImage}
              src={activeImage}
              fallbackSources={selectedColorImages.length ? product.images : []}
              alt={`${product.title}${selectedColor ? ` - ${selectedColor}` : ""}`}
              loading="eager"
            />
          </div>
          {galleryImages.length > 1 && (
            <div className="pd-thumbs">
              {galleryImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === activeImg ? "active" : ""}
                  onClick={() => setActiveImg(i)}
                  aria-label={`Show product image ${i + 1}`}
                >
                  <LoadingImage src={img} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <h1>{product.title}</h1>
          <p className="pd-price">Rs. {(product.salePrice ?? product.price).toLocaleString("en-IN")}.00 {product.discount > 0 && <del>Rs. {product.price.toLocaleString("en-IN")}</del>} {product.discount > 0 && <strong className="discount-badge">{product.discount}% OFF</strong>}</p>
          {!loadingReviews && !reviewLoadError && productReviews.length > 0 && (
            <a className="pd-review-link" href="#product-reviews">
              <span aria-hidden="true">{"★".repeat(Math.round(averageReviewRating))}</span>
              <strong>{averageReviewRating.toFixed(1)}</strong>
              <span>{productReviews.length} customer review{productReviews.length === 1 ? "" : "s"}</span>
            </a>
          )}
          <p className="pd-sku">SKU: {product.sku}</p>

          {product.colors?.length > 0 && (
            <div className="pd-colors">
              <h4>Color</h4>
              <div className="swatches">
                {product.colors.map((c) => (
                  <button key={c.name} type="button" className={`variant-swatch ${selectedColor === c.name ? "selected" : ""} ${c.stock <= 0 ? "unavailable" : ""}`} title={c.stock <= 0 ? `${c.name} unavailable` : c.name} aria-label={`${c.name}${c.stock <= 0 ? ", unavailable" : ""}`} aria-pressed={selectedColor === c.name} onClick={() => c.stock > 0 && selectColor(c)}><span className="swatch big" style={{ background: c.hex }} /><span className="variant-name">{c.name}</span>{c.stock <= 0 && <span className="variant-cross" />}</button>
                ))}
              </div>
            </div>
          )}

          {product.sizes?.length > 0 && (
            <div className="pd-sizes">
              <h4>Size</h4>
              <div className="size-options">{product.sizes.map((size) => { const variant = product.variantStock?.find((entry) => entry.size === size && entry.color === selectedColor); const stock = product.variantStock?.length ? variant?.stock ?? 0 : product.stock ?? 0; return <button type="button" key={size} className={`${selectedSize === size ? "selected" : ""} ${stock <= 0 ? "unavailable" : ""}`} disabled={stock <= 0} onClick={() => setSelectedSize(size)}>{size}{stock <= 0 && <span className="variant-cross" />}</button>; })}</div>
            </div>
          )}

          <div className="quantity-control"><h4>Quantity</h4><div><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button><strong>{quantity}</strong><button type="button" aria-label="Increase quantity" disabled={quantity >= availableStock} onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))}><Plus size={15} /></button></div></div>

          <div className="pd-actions">
            <button className="buy-now-btn large" onClick={handleBuyNow} disabled={isUnavailable || quantity > availableStock}>
              <span>{isUnavailable ? "OUT OF STOCK" : "BUY IT NOW"}</span>
              {!isUnavailable && (
                <span className="buy-now-payment-marks" aria-label="Payment options: Paytm, PhonePe, and Google Pay">
                  <span className="buy-payment-icon paytm-icon"><img src="/payment-methods/paytm.png" alt="" /></span>
                  <span className="buy-payment-icon phonepe-icon"><img src="/payment-methods/phonepe.png" alt="" /></span>
                  <span className="buy-payment-icon gpay-icon"><img src="/payment-methods/google-pay.png" alt="" /></span>
                </span>
              )}
              <ChevronRight className="buy-now-arrow" size={30} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <div className="pd-payment-options">
              <span className="pd-payment-heading">Checkout securely with</span>
              <div className="pd-payment-brands" aria-label="Visa, Mastercard, UPI, Paytm, Google Pay, PhonePe, and RuPay">
                <span className="payment-brand visa-mark"><img src="/payment-methods/visa.png" alt="Visa" /></span>
                <span className="payment-brand mastercard-mark"><img src="/payment-methods/mastercard.png" alt="Mastercard" /></span>
                <span className="payment-brand gpay-mark"><img src="/payment-methods/google-pay.png" alt="Google Pay" /></span>
                <span className="payment-brand upi-mark"><img src="/payment-methods/upi.png" alt="UPI" /></span>
                <span className="payment-brand rupay-mark"><img src="/payment-methods/rupay.png" alt="RuPay" /></span>
                <span className="payment-brand paytm-mark"><img src="/payment-methods/paytm.png" alt="Paytm" /></span>
                <span className="payment-brand phonepe-mark"><img src="/payment-methods/phonepe.png" alt="PhonePe" /></span>
              </div>
            </div>
            <div className="pd-icon-row">
              <button className={`like-btn ${liked ? "liked" : ""}`} onClick={() => toggleLike(product._id)}>
                <Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}
              </button>
              <button className="share-btn" onClick={handleShare}>
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>

          <div className="pd-tabs">
            <div className="pd-tab-heads">
              {["description", "care", "shipping"].map((t) => (
                <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                  {t === "description" ? "Description" : t === "care" ? "Care Guide" : "Shipping and Exchange"}
                </button>
              ))}
            </div>
            <div className="pd-tab-body">
              {tab === "description" && <p>{product.description}</p>}
              {tab === "care" && <p>{product.careGuide}</p>}
              {tab === "shipping" && <p>{product.shipping}</p>}
            </div>
          </div>
        </div>
      </div>

      <section id="product-reviews" className="product-reviews" aria-labelledby="product-reviews-heading">
        <div className="product-reviews-heading">
          <div>
            <p className="eyebrow">From our customers</p>
            <h2 id="product-reviews-heading">Customer reviews</h2>
          </div>
          {!loadingReviews && !reviewLoadError && productReviews.length > 0 && (
            <p className="product-review-summary">
              <strong>★ {averageReviewRating.toFixed(1)}</strong>
              <span>{productReviews.length} review{productReviews.length === 1 ? "" : "s"}</span>
            </p>
          )}
        </div>
        {loadingReviews ? <p>Loading reviews…</p> : reviewLoadError ? (
          <p className="error" role="alert">{reviewLoadError}</p>
        ) : productReviews.length ? (
          <div className="product-review-list">
            {productReviews.map((review) => (
              <article className="product-review-card" key={review._id}>
                <div className="product-review-meta">
                  <strong>{review.authorName}</strong>
                  <span className="product-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </span>
                  <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("en-IN")}</time>
                </div>
                <p>{review.text}</p>
                {review.images?.length > 0 && (
                  <div className="review-image-list">
                    {review.images.map((image) => (
                      <a key={image.publicId} href={image.url} target="_blank" rel="noreferrer">
                        <img src={image.url} alt={`Photo shared by ${review.authorName}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : <p>No customer reviews yet. Be the first to share your experience after delivery.</p>}
      </section>

      {relatedProduct && (
        <section className="products-section product-recommendation-section">
          <p className="eyebrow">Picked for you</p>
          <h2>You may also like</h2>
          <div className="product-row product-recommendation-row">
            <ProductCard product={relatedProduct} showBuyNow={false} />
          </div>
        </section>
      )}
      <div className="mobile-product-buy-bar">
        <div className="mobile-product-buy-price">
          <span>{isUnavailable ? "Currently unavailable" : "Price"}</span>
          <strong>Rs. {Number(product.salePrice ?? product.price).toLocaleString("en-IN")}.00</strong>
        </div>
        <button type="button" className="mobile-product-buy-button" onClick={handleBuyNow} disabled={isUnavailable || quantity > availableStock}>
          {isUnavailable ? "Sold out" : "Buy now"}
          {!isUnavailable && <ChevronRight size={20} aria-hidden="true" />}
        </button>
      </div>
      <HomeFeatures products={[]} content={homepageContent} showColors={false} />
    </main>
  );
}
