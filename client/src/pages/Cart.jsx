import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { startCheckout } from "../utils/checkout.js";
import { getRecommendedProducts } from "../utils/productRecommendations.js";
import ProductCard from "../components/ProductCard.jsx";

function getLineStock(product, item) {
  if (!product || product.soldOut) return 0;
  if (product.variantStock?.length) {
    return product.variantStock.find((variant) => variant.size === item.size && variant.color === item.color)?.stock || 0;
  }
  if (product.colors?.length) {
    const color = product.colors.find((entry) => entry.name === item.color);
    if (!color) return 0;
    if (color.stock !== undefined && color.stock !== null) return color.stock;
  }
  return Number(product.stock) || 0;
}

export default function Cart() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { cart, itemCount, updateQuantity, changeSize, removeFromCart } = useCart();
  const [products, setProducts] = useState({});
  const [recommendationCatalog, setRecommendationCatalog] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const hasCartItems = cart.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!hasCartItems) {
      setRecommendationCatalog([]);
      setRecommendationsError("");
      setRecommendationsLoading(false);
      return () => { cancelled = true; };
    }

    setRecommendationsLoading(true);
    setRecommendationsError("");
    api.get("/products", { params: { limit: 50 } })
      .then(({ data }) => {
        if (cancelled) return;
        if (!Array.isArray(data?.products)) {
          throw new Error("The product list response was invalid.");
        }
        setRecommendationCatalog(data.products);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Unable to load cart recommendations:", error);
        setRecommendationsError("Product suggestions could not be loaded right now.");
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });

    return () => { cancelled = true; };
  }, [hasCartItems]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const productIds = [...new Set(cart.map((item) => item.productId))];
    if (!productIds.length) {
      setProducts({});
      setLoading(false);
      return () => { cancelled = true; };
    }

    Promise.all(productIds.map(async (productId) => {
      try {
        const { data } = await api.get(`/products/${encodeURIComponent(productId)}`);
        return [productId, data];
      } catch (error) {
        console.error(`Unable to refresh cart product ${productId}:`, error);
        return [productId, null];
      }
    })).then((entries) => {
      if (!cancelled) {
        setProducts(Object.fromEntries(entries));
        if (entries.some(([, product]) => !product)) {
          setLoadError("Some products could not be refreshed. Remove unavailable items or try again.");
        }
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cart, refreshKey]);

  const lineItems = useMemo(() => cart.map((item) => {
    const product = products[item.productId];
    const stock = getLineStock(product, item);
    return {
      ...item,
      product,
      stock,
      price: Number(product?.salePrice ?? product?.price ?? item.price ?? 0),
      available: Boolean(product && stock > 0),
    };
  }), [cart, products]);
  const subtotal = lineItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const canCheckout = !loading && lineItems.length > 0 && lineItems.length <= 30
    && lineItems.every((item) => item.available && item.quantity <= item.stock);
  const recommendations = useMemo(() => getRecommendedProducts(
    recommendationCatalog,
    lineItems.map((item) => item.product).filter(Boolean),
    4
  ), [recommendationCatalog, lineItems]);

  function checkout() {
    if (!canCheckout) return;
    startCheckout(navigate, lineItems.map((item) => ({
      productId: item.productId,
      title: item.product.title,
      slug: item.product.slug,
      image: item.product.images?.[0] || "",
      price: item.price,
      quantity: item.quantity,
      color: item.color,
      size: item.size,
    })), { fromCart: true });
  }

  function changeQuantity(item, quantity) {
    if (quantity > item.stock) {
      showToast(`Only ${item.stock} available for this option.`);
      return;
    }
    updateQuantity(item.key, quantity);
  }

  function changeItemSize(item, size) {
    if (!item.product || !size || size === item.size) return;

    const stock = getLineStock(item.product, { ...item, size });
    const targetKey = `${item.productId}::${item.color || ""}::${size}`;
    const existingItem = lineItems.find((entry) => entry.key === targetKey && entry.key !== item.key);
    const nextQuantity = item.quantity + (existingItem?.quantity || 0);
    if (stock < nextQuantity) {
      showToast(`Only ${stock} available in size ${size}.`);
      return;
    }

    try {
      changeSize(item.key, size);
      showToast(`Size updated to ${size}.`);
    } catch (error) {
      showToast(error.message || "Unable to update the selected size.");
    }
  }

  return (
    <main className="cart-page">
      <p className="eyebrow">Your selection</p>
      <h1>Shopping cart <span>({itemCount} {itemCount === 1 ? "item" : "items"})</span></h1>
      {loadError && (
        <p className="cart-error" role="alert">
          {loadError}{" "}
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button>
        </p>
      )}
      {loading ? (
        <p className="cart-loading" role="status">Checking current prices and availability…</p>
      ) : lineItems.length === 0 ? (
        <section className="cart-empty">
          <ShoppingBag size={36} strokeWidth={1.5} aria-hidden="true" />
          <h2>Your cart is empty</h2>
          <p>Find something you love and add it here.</p>
          <Link className="cart-continue-button" to="/collections/trending">Continue shopping</Link>
        </section>
      ) : (
        <>
          <div className="cart-layout">
            <section className="cart-lines" aria-label="Items in your cart">
              {lineItems.map((item) => (
                <article className={`cart-line${item.available && item.quantity <= item.stock ? "" : " cart-line-unavailable"}`} key={item.key}>
                  <Link to={item.product?.slug ? `/products/${item.product.slug}` : "/collections/trending"} className="cart-line-image">
                    <img src={item.product?.images?.[0] || item.image} alt={item.product?.title || item.title} />
                  </Link>
                  <div className="cart-line-details">
                    <Link className="cart-line-title" to={item.product?.slug ? `/products/${item.product.slug}` : "/collections/trending"}>
                      {item.product?.title || item.title}
                    </Link>
                    <span>{[item.color, item.product?.sizes?.length ? "" : item.size].filter(Boolean).join(" · ") || "Standard option"}</span>
                    <strong>Rs. {item.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {item.product?.sizes?.length > 0 && (
                      <label className="cart-size-selector">
                        <span>Size</span>
                        <select
                          value={item.size || ""}
                          aria-label={`Size for ${item.product.title}`}
                          onChange={(event) => changeItemSize(item, event.target.value)}
                        >
                          {!item.size && <option value="" disabled>Choose a size</option>}
                          {item.size && !item.product.sizes.includes(item.size) && (
                            <option value={item.size}>{item.size} (no longer listed)</option>
                          )}
                          {item.product.sizes.map((size) => {
                            const sizeStock = getLineStock(item.product, { ...item, size });
                            return (
                              <option key={size} value={size} disabled={sizeStock <= 0 && size !== item.size}>
                                {size}{sizeStock <= 0 ? " (out of stock)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    )}
                    {!item.available && <span className="cart-line-stock" role="alert">This option is unavailable. Select another size or remove it.</span>}
                    {item.available && item.quantity > item.stock && <span className="cart-line-stock" role="alert">Only {item.stock} available. Reduce the quantity to continue.</span>}
                    <div className="cart-line-controls">
                      <div className="cart-quantity-control" aria-label={`Quantity for ${item.product?.title || item.title}`}>
                        <button type="button" aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => changeQuantity(item, item.quantity - 1)}><Minus size={14} /></button>
                        <span>{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity" disabled={!item.available || item.quantity >= Math.min(item.stock, 20)} onClick={() => changeQuantity(item, item.quantity + 1)}><Plus size={14} /></button>
                      </div>
                      <button className="cart-remove-button" type="button" onClick={() => removeFromCart(item.key)}>
                        <Trash2 size={15} aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                  <strong className="cart-line-total">Rs. {(item.price * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </article>
              ))}
            </section>
            <aside className="cart-summary">
              <h2>Order summary</h2>
              <p><span>Subtotal ({itemCount} items)</span><strong>Rs. {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
              <p><span>Shipping</span><strong>Free</strong></p>
              <p className="cart-summary-total"><span>Total</span><strong>Rs. {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
              <button type="button" className="cart-checkout-button" onClick={checkout} disabled={!canCheckout}>Proceed to checkout</button>
              {!canCheckout && !loading && <p className="cart-checkout-hint">{lineItems.length > 30 ? "A cart can contain up to 30 product options." : "Update or remove unavailable items to continue."}</p>}
              <Link to="/collections/trending" className="cart-continue-link">Continue shopping</Link>
            </aside>
          </div>
          <section className="cart-recommendations" aria-labelledby="cart-recommendations-title">
            <div className="cart-recommendations-heading">
              <div>
                <p className="eyebrow">Picked for your cart</p>
                <h2 id="cart-recommendations-title">You may also like</h2>
                <p>Related styles selected to go with your picks.</p>
              </div>
            </div>
            {recommendationsLoading && <p className="cart-recommendations-status" role="status">Finding styles you may like…</p>}
            {recommendationsError && <p className="cart-recommendations-status cart-recommendations-error" role="alert">{recommendationsError}</p>}
            {!recommendationsLoading && !recommendationsError && recommendations.length > 0 && (
              <div className="product-row grid4 cart-recommendation-grid">
                {recommendations.map((product) => (
                  <ProductCard key={product._id} product={product} showBuyNow={false} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
