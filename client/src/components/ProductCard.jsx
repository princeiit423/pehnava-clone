import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLikes } from "../context/LikesContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "./Toast.jsx";
import { startCheckout } from "../utils/checkout.js";
import { useProductImpression } from "../hooks/useProductImpression.js";
import ProductImpressionBadge from "./ProductImpressionBadge.jsx";
import LoadingImage from "./LoadingImage.jsx";
import { Heart, Share2 } from "lucide-react";

export default function ProductCard({ product, showBuyNow = true }) {
  const { isLiked, toggleLike } = useLikes();
  const { addToCart } = useCart();
  const showToast = useToast();
  const navigate = useNavigate();
  const { targetRef: impressionTargetRef, impressionCount } = useProductImpression(product._id);
  const displayedImpressionCount = impressionCount ?? product.impressionCount;
  const liked = isLiked(product._id);

  function handleShare(e) {
    e.preventDefault();
    const url = `${window.location.origin}/products/${product.slug}`;
    if (navigator.share) {
      navigator.share({ title: product.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      showToast("Product link copied!");
    }
  }

 function handleBuyNow(e) {
  e.preventDefault();
  const variant = product.variantStock?.find((entry) => entry.stock > 0);
  const color = variant?.color || product.colors?.find((entry) => entry.stock > 0)?.name || "";
  const size = variant?.size || product.sizes?.[0] || "";
  startCheckout(navigate, {
    productId: product._id,
    title: product.title,
    image: product.images?.[0] || "",
    price: Number(product.salePrice ?? product.price * (1 - (product.discount || 0) / 100)),
    quantity: 1,
    size,
    color,
  });
}

  function handleAddToCart() {
    const variant = product.variantStock?.find((entry) => entry.stock > 0);
    const color = variant?.color || product.colors?.find((entry) => entry.stock > 0)?.name || "";
    const size = variant?.size || product.sizes?.[0] || "";
    try {
      addToCart({
        productId: product._id,
        title: product.title,
        slug: product.slug,
        image: product.images?.[0] || "",
        price: Number(product.salePrice ?? product.price * (1 - (product.discount || 0) / 100)),
        quantity: 1,
        size,
        color,
      });
      showToast("Added to cart.");
    } catch (error) {
      showToast(error.message || "Unable to add this product to your cart.");
    }
  }

  function handleLike(e) {
    e.preventDefault();
    toggleLike(product._id).catch((error) => {
      console.error("Unable to update wishlist:", error);
      showToast(error.response?.data?.message || "Unable to update your wishlist.");
    });
  }

  const sizeLabel = product.sizes?.join(" / ");

  return (
    <div className="product">
      <Link ref={impressionTargetRef} to={`/products/${product.slug}`} className="product-img">
        <ProductImpressionBadge count={displayedImpressionCount} />
        {product.soldOut && <div className="stock-overlay"><strong>Out of stock</strong><span>Currently unavailable</span></div>}
        {product.soldOut && <span className="badge sold-out">SOLD OUT</span>}
        {!product.soldOut && product.isNew && <span className="badge new">NEW</span>}
        <LoadingImage
          src={product.images?.[0]}
          fallbackSources={product.images?.slice(1)}
          alt={product.title}
        />
        <div className="size-overlay">{sizeLabel}</div>
        <div className="card-icons">
          <button title="Share" onClick={handleShare}>
            <Share2 size={16} strokeWidth={1.8} />
          </button>
          <button
            title={liked ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
            className={liked ? "liked" : ""}
            onClick={handleLike}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={1.8} />
          </button>
        </div>
      </Link>
      <Link to={`/products/${product.slug}`} className="product-title">
        {product.title}
      </Link>
      <p className="product-price">
        {product.categories?.includes("from-price") ? "From " : ""}Rs.{" "}
        {(product.salePrice ?? product.price).toLocaleString("en-IN")}.00
        {product.discount > 0 && <del> Rs. {product.price.toLocaleString("en-IN")}</del>}
        {product.discount > 0 && <span className="discount-badge">{product.discount}% OFF</span>}
      </p>
      <button className="add-to-cart-btn" type="button" onClick={handleAddToCart} disabled={product.soldOut}>
        {product.soldOut ? "SOLD OUT" : "ADD TO CART"}
      </button>
      {product.colors?.length > 0 && (
        <div className="swatches">
          {product.colors.map((c) => (
            <Link
              key={c.name}
              to={`/products/${product.slug}?color=${encodeURIComponent(c.name)}`}
              className="swatch swatch-link"
              title={c.name}
              aria-label={`View ${product.title} in ${c.name}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}{showBuyNow && (
  <button
    className="buy-now-btn"
    onClick={handleBuyNow}
    disabled={product.soldOut}
  >
    {product.soldOut ? "SOLD OUT" : "BUY IT NOW"}
  </button>
)}
    </div>
  );
}
