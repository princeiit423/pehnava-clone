import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setCustomerToken } from "../api.js";
import { Camera, Eye, EyeOff, MessageCircle, Mail } from "lucide-react";

const ORDER_PHASES = [
  ["order_placed", "Order Placed"],
  ["payment_confirmed", "Payment Confirmed"],
  ["processing_packed", "Processing / Packed"],
  ["shipped", "Shipped"],
  ["out_for_delivery", "Out for Delivery"],
  ["delivered", "Delivered"],
];

const LEGACY_STATUS = {
  pending: "order_placed",
  paid: "payment_confirmed",
  processing: "processing_packed",
  shipped: "shipped",
  cancelled: "cancelled_refund",
};

function normalizedStatus(status) {
  return LEGACY_STATUS[status] || status || "order_placed";
}

function orderStatusLabel(status) {
  if (normalizedStatus(status) === "cancelled_refund") return "Cancelled / Refund";
  return ORDER_PHASES.find(([value]) => value === normalizedStatus(status))?.[1] || status;
}

export default function Account() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", identifier: "", phone: "", email: "", password: "", marketingConsent: true });
  const [showPassword, setShowPassword] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviews, setReviews] = useState([]);
  const [editingReviews, setEditingReviews] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [savingReview, setSavingReview] = useState("");
  const [deletingReview, setDeletingReview] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get("/customers/me")
      .then((res) => {
        if (cancelled) return;
        setCustomer(res.data);
        if (searchParams.get("checkout") === "1" && sessionStorage.getItem("kcs_checkout_item")) {
          navigate("/checkout", { replace: true });
        }
      })
      .catch((err) => {
        if (!cancelled && err.response?.status !== 401) {
          setError(err.response?.data?.message || "Unable to load your account.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAccount(false);
      });
    return () => { cancelled = true; };
  }, [navigate, searchParams]);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setLoadingOrders(true);
    Promise.all([api.get("/orders"), api.get("/reviews/mine")])
      .then(([ordersResponse, reviewsResponse]) => {
        if (!cancelled) {
          setOrders(ordersResponse.data);
          setReviews(reviewsResponse.data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Unable to load your orders.");
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });
    return () => { cancelled = true; };
  }, [customer]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = mode === "login"
        ? { identifier: form.identifier.trim(), password: form.password }
        : { ...form, phone: form.phone.trim(), email: form.email.trim() || undefined };
      const res = await api.post(`/customers/${mode}`, payload);
      setCustomerToken(res.data.token);
      setCustomer(res.data.customer);
      if (searchParams.get("checkout") === "1" && sessionStorage.getItem("kcs_checkout_item")) {
        navigate("/checkout", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to continue. Please try again.");
    }
  }

  function getProductReview(order, item) {
    return reviews.find((review) => review.order === order._id && review.product === item.productId);
  }

  async function submitReview(order, item, key) {
    const existing = getProductReview(order, item);
    const draft = reviewDrafts[key] || {
      rating: existing?.rating || 5,
      text: existing?.text || "",
      images: [],
      keepImagePublicIds: existing?.images.map((image) => image.publicId) || [],
    };
    setReviewErrors((current) => ({ ...current, [key]: "" }));
    setSavingReview(key);
    try {
      const formData = new FormData();
      formData.append("rating", String(draft.rating));
      formData.append("text", draft.text);
      if (!existing) formData.append("productId", item.productId);
      if (existing) {
        formData.append("keepImagePublicIds", JSON.stringify(
          draft.keepImagePublicIds || existing.images.map((image) => image.publicId)
        ));
      }
      (draft.images || []).forEach((image) => formData.append("images", image));
      const response = existing
        ? await api.patch(`/reviews/${existing._id}`, formData)
        : await api.post(`/reviews/orders/${order._id}`, formData);
      setReviews((current) => existing
        ? current.map((review) => review._id === existing._id ? response.data.review : review)
        : [response.data.review, ...current]);
      setEditingReviews((current) => ({ ...current, [key]: false }));
      setReviewDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (response.data.warning) setReviewErrors((current) => ({ ...current, [key]: response.data.warning }));
    } catch (err) {
      setReviewErrors((current) => ({ ...current, [key]: err.response?.data?.message || "Unable to save your review." }));
    } finally {
      setSavingReview("");
    }
  }

  async function deleteReview(review, key) {
    if (!window.confirm("Delete your review and its uploaded images?")) return;
    setReviewErrors((current) => ({ ...current, [key]: "" }));
    setDeletingReview(review._id);
    try {
      const response = await api.delete(`/reviews/${review._id}`);
      setReviews((current) => current.filter((item) => item._id !== review._id));
      setReviewDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (response.data.warning) setReviewErrors((current) => ({ ...current, [key]: response.data.warning }));
    } catch (err) {
      setReviewErrors((current) => ({ ...current, [key]: err.response?.data?.message || "Unable to delete your review." }));
    } finally {
      setDeletingReview("");
    }
  }

  if (loadingAccount) {
    return <main className="account-page"><p>Checking your account…</p></main>;
  }

  if (!customer) {
    return (
      <main className="account-page">
        <form className="account-form" onSubmit={submit}>
          <h1>{mode === "login" ? "Your account" : "Create account"}</h1>
          {mode === "register" && <input placeholder="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
          {mode === "login" ? (
            <input autoComplete="username" placeholder="Enter your Mail ID/Phone Number" required value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
          ) : (
            <>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit phone number"
                pattern="[6-9][0-9]{9}"
                maxLength="10"
                title="Enter a valid 10-digit Indian mobile number."
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
              />
              <input
                type="email"
                autoComplete="email"
                placeholder="Email address"
                maxLength="254"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value.trim() })}
              />
            </>
          )}
          <div className="account-password-field">
            <input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} minLength="8" placeholder="Password (8+ characters)" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <button type="button" className="password-visibility-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mode === "register" && <label><input type="checkbox" checked={form.marketingConsent} onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })} /> Send me product updates and offers</label>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create a new account" : "Already have an account? Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-head">
        <div><p className="eyebrow">Welcome back</p><h1>{customer.name}</h1><p>{customer.phone}{customer.email ? ` | ${customer.email}` : ""}</p></div>
        <button onClick={() => { setCustomerToken(null); setCustomer(null); setOrders([]); setReviews([]); }}>Sign out</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {searchParams.get("orderPlaced") && <p className="checkout-success" role="status">Payment confirmed — your order is placed. You can follow its progress below.</p>}
      <section className="orders">
        <h2>Your orders</h2>
        {loadingOrders ? <p>Loading your orders…</p> : orders.length ? orders.map((order) => {
          const status = normalizedStatus(order.status);
          const phaseIndex = ORDER_PHASES.findIndex(([value]) => value === status);
          const cancelled = status === "cancelled_refund";
          return (
            <article className="order-row customer-order-card" key={order._id}>
              <div className="customer-order-heading">
                <div><strong>Order #{order._id.slice(-8).toUpperCase()}</strong><span>{new Date(order.createdAt).toLocaleDateString("en-IN")}</span></div>
                <div><strong>Rs. {Number(order.total || 0).toLocaleString("en-IN")}</strong><span className={`order-status status-${status}`}>{orderStatusLabel(status)}</span></div>
              </div>
              <div className={`order-phase-track${cancelled ? " is-cancelled" : ""}`} aria-label={`Order status: ${orderStatusLabel(status)}`}>
                {cancelled ? <strong>Cancelled / Refund</strong> : ORDER_PHASES.map(([value, label], index) => (
                  <div key={value} className={`order-phase${index <= phaseIndex ? " is-complete" : ""}${index === phaseIndex ? " is-current" : ""}`}>
                    <i />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {cancelled && <p className="cancelled-payment-note">Any eligible payment refund is processed manually; this status does not issue an automatic refund.</p>}
              <div className="customer-order-items">
                {(order.items || []).map((item, index) => (
                  (() => {
                    const key = `${order._id}:${item.productId || index}`;
                    const review = getProductReview(order, item);
                    const editing = Boolean(editingReviews[key]);
                    const draft = reviewDrafts[key] || {
                      rating: review?.rating || 5,
                      text: review?.text || "",
                      images: [],
                      keepImagePublicIds: review?.images.map((image) => image.publicId) || [],
                    };
                    const updateDraft = (changes) => setReviewDrafts((current) => ({
                      ...current,
                      [key]: { ...draft, ...changes },
                    }));
                    const productHref = item.slug || item.productId
                      ? `/products/${encodeURIComponent(item.slug || item.productId)}`
                      : "";
                    return (
                      <div className="customer-order-product" key={`${item.productId}-${index}`}>
                        {productHref ? (
                          <Link className="customer-order-item" to={productHref}>
                            {item.image && <img src={item.image} alt="" loading="lazy" />}
                            <span><strong>{item.title}</strong><small>{[item.color, item.size].filter(Boolean).join(" · ")}{item.quantity ? ` · Qty ${item.quantity}` : ""}</small></span>
                          </Link>
                        ) : (
                          <div className="customer-order-item">
                            {item.image && <img src={item.image} alt="" loading="lazy" />}
                            <span><strong>{item.title}</strong><small>{[item.color, item.size].filter(Boolean).join(" · ")}{item.quantity ? ` · Qty ${item.quantity}` : ""}</small></span>
                          </div>
                        )}
                        {status === "delivered" && review && !editing && (
                          <div className="submitted-order-review">
                            <strong>Your review</strong>
                            <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                            <p>{review.text}</p>
                            {review.images?.length > 0 && <div className="review-image-list">{review.images.map((image) => <img key={image.publicId} src={image.url} alt="Review upload" loading="lazy" />)}</div>}
                            <div className="review-owner-actions">
                              <button type="button" onClick={() => {
                                setReviewDrafts((current) => ({
                                  ...current,
                                  [key]: { rating: review.rating, text: review.text, images: [], keepImagePublicIds: review.images.map((image) => image.publicId) },
                                }));
                                setEditingReviews((current) => ({ ...current, [key]: true }));
                              }}>Edit review</button>
                              <button type="button" className="review-delete-button" disabled={deletingReview === review._id} onClick={() => deleteReview(review, key)}>{deletingReview === review._id ? "Deleting…" : "Delete review"}</button>
                            </div>
                            {reviewErrors[key] && <p className="error" role="alert">{reviewErrors[key]}</p>}
                          </div>
                        )}
                        {status === "delivered" && (!review || editing) && (
                          <div className="order-review-form">
                            <h3>{review ? "Edit your review" : `Review ${item.title}`}</h3>
                            <label>Rating
                              <select value={draft.rating} onChange={(event) => updateDraft({ rating: Number(event.target.value) })}>
                                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}
                              </select>
                            </label>
                            <textarea maxLength="1000" rows="3" placeholder="Share your experience" value={draft.text} onChange={(event) => updateDraft({ text: event.target.value })} />
                            {review && review.images?.length > 0 && (
                              <div className="review-image-list">
                                {review.images.map((image) => {
                                  const retained = (draft.keepImagePublicIds || []).includes(image.publicId);
                                  return (
                                    <button key={image.publicId} type="button" className={`review-image-toggle${retained ? "" : " is-removed"}`} onClick={() => updateDraft({
                                      keepImagePublicIds: retained
                                        ? draft.keepImagePublicIds.filter((id) => id !== image.publicId)
                                        : [...draft.keepImagePublicIds, image.publicId],
                                    })} aria-pressed={retained} title={retained ? "Remove image" : "Keep image"}>
                                      <img src={image.url} alt={retained ? "Current review image" : "Image marked for removal"} />
                                      <span>{retained ? "Remove" : "Removed"}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            <label className="review-upload-label">Add up to {3 - (draft.keepImagePublicIds || []).length} images (5 MB max each)
                              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
                                const files = Array.from(event.target.files || []);
                                const keptCount = review ? (draft.keepImagePublicIds || []).length : 0;
                                const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
                                if (invalid) {
                                  setReviewErrors((current) => ({ ...current, [key]: invalid.size > 5 * 1024 * 1024 ? "Each review image must be 5 MB or smaller." : "Choose JPEG, PNG, or WebP images." }));
                                  event.target.value = "";
                                  return;
                                }
                                if (keptCount + (draft.images || []).length + files.length > 3) {
                                  setReviewErrors((current) => ({ ...current, [key]: "A review can include no more than 3 images." }));
                                  event.target.value = "";
                                  return;
                                }
                                setReviewErrors((current) => ({ ...current, [key]: "" }));
                                updateDraft({ images: [...(draft.images || []), ...files] });
                                event.target.value = "";
                              }} />
                            </label>
                            {draft.images?.length > 0 && <ul className="review-new-files">{draft.images.map((file, fileIndex) => <li key={`${file.name}-${fileIndex}`}>{file.name}</li>)}</ul>}
                            {reviewErrors[key] && <p className="error" role="alert">{reviewErrors[key]}</p>}
                            <div className="review-owner-actions">
                              <button type="button" disabled={savingReview === key} onClick={() => submitReview(order, item, key)}>{savingReview === key ? "Saving…" : review ? "Save changes" : "Submit review"}</button>
                              {review && <button type="button" onClick={() => {
                                setEditingReviews((current) => ({ ...current, [key]: false }));
                                setReviewDrafts((current) => {
                                  const next = { ...current };
                                  delete next[key];
                                  return next;
                                });
                              }}>Cancel</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
              {(order.carrier || order.trackingNumber) && <p className="customer-tracking"><strong>Tracking:</strong> {order.carrier || "Carrier"}{order.trackingNumber ? ` · ${order.trackingNumber}` : ""}</p>}
              {order.editedAt && <p className="order-edited-note">Order information updated by store on {new Date(order.editedAt).toLocaleString("en-IN")}.</p>}
            </article>
          );
        }) : <p>No orders yet.</p>}
      </section>
      <section className="order-help">
        <h2>Need help with your order?</h2>
        <p>Contact our team and share your order number for faster help.</p>
        <div>
          <a href="https://www.instagram.com/kashmirclothstores/" target="_blank" rel="noreferrer"><Camera size={17} /> Instagram</a>
          <a href="https://wa.me/917004281547" target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp · 7004281547</a>
          <a href="mailto:amaanhussain786pr@gmail.com"><Mail size={17} /> amaanhussain786pr@gmail.com</a>
        </div>
      </section>
    </main>
  );
}
