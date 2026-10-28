import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLikes } from "../context/LikesContext.jsx";
import { useToast } from "./Toast.jsx";
import { startCheckout } from "../utils/checkout.js";
import LoadingImage from "./LoadingImage.jsx";
import { Heart, Share2 } from "lucide-react";

export default function ProductCard({ product, showBuyNow = true }) {
  const { isLiked, toggleLike } = useLikes();
  const showToast = useToast();
  const navigate = useNavigate();
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

  function handleLike(e) {
    e.preventDefault();
    toggleLike(product._id);
  }

  const sizeLabel = product.sizes?.join(" / ");

  return (
    <div className="product">
      <Link to={`/products/${product.slug}`} className="product-img">
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
            title={liked ? "Unlike" : "Like"}
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
