import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setCustomerToken } from "../api.js";
import {
  ArrowRight,
  Ban,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  PackageCheck,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { hasCheckoutItems } from "../utils/checkout.js";

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

function canRequestReturn(order, now = Date.now()) {
  if (normalizedStatus(order.status) !== "delivered") return false;
  const deliveredAt = order.deliveredAt || order.updatedAt;
  const deliveryTime = new Date(deliveredAt).getTime();
  return Number.isFinite(deliveryTime)
    && now >= deliveryTime
    && now <= deliveryTime + 7 * 24 * 60 * 60 * 1000;
}

function canCancelOrder(status) {
  return ["order_placed", "payment_confirmed"].includes(normalizedStatus(status));
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
  const [returnDrafts, setReturnDrafts] = useState({});
  const [returnErrors, setReturnErrors] = useState({});
  const [savingReturn, setSavingReturn] = useState("");
  const [cancellingOrder, setCancellingOrder] = useState("");
  const [cancelErrors, setCancelErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    api.get("/customers/me")
      .then((res) => {
        if (cancelled) return;
        setCustomer(res.data);
        if (searchParams.get("checkout") === "1" && hasCheckoutItems()) {
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
      if (searchParams.get("checkout") === "1" && hasCheckoutItems()) {
        navigate("/checkout", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to continue. Please try again.");
    }
  }

  function getProductReview(order, item) {
    return reviews.find((review) => review.order === order._id && review.product === item.productId);
  }

  async function submitReturnRequest(order) {
    const draft = returnDrafts[order._id] || { type: "return", reason: "" };
    setReturnErrors((current) => ({ ...current, [order._id]: "" }));
    setSavingReturn(order._id);
    try {
      const { data } = await api.post(`/orders/${order._id}/return-request`, draft);
      setOrders((current) => current.map((entry) => entry._id === order._id ? data : entry));
      setReturnDrafts((current) => {
        const next = { ...current };
        delete next[order._id];
        return next;
      });
    } catch (requestError) {
      setReturnErrors((current) => ({
        ...current,
        [order._id]: requestError.response?.data?.message || "Unable to submit your request. Please try again.",
      }));
    } finally {
      setSavingReturn("");
    }
  }

  async function cancelOrder(order) {
    const paidOnline = order.paymentMethod !== "cod";
    const confirmation = paidOnline
      ? "Cancel this order? Any eligible online-payment refund is handled manually and is not issued automatically."
      : "Cancel this order? This action cannot be undone.";
    if (!window.confirm(confirmation)) return;

    setCancelErrors((current) => ({ ...current, [order._id]: "" }));
    setCancellingOrder(order._id);
    try {
      const { data } = await api.post(`/orders/${order._id}/cancel`);
      setOrders((current) => current.map((entry) => entry._id === order._id ? data : entry));
    } catch (cancelError) {
      setCancelErrors((current) => ({
        ...current,
        [order._id]: cancelError.response?.data?.message || "Unable to cancel this order. Please try again.",
      }));
    } finally {
      setCancellingOrder("");
    }
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
    return <main className="account-page account-loading"><p>Checking your account…</p></main>;
  }

  if (!customer) {
    return (
      <main className="account-page account-auth">
        <section className="auth-brand-panel" aria-label="RacoonBro brand">
          <Link className="auth-brand-logo" to="/" aria-label="RacoonBro home">
            <img src="/Logos/RacoonBro_primary_logo.png" alt="RacoonBro — Wear the Attitude" />
          </Link>
          <div className="auth-brand-copy">
            <span className="auth-brand-kicker"><Sparkles size={14} aria-hidden="true" /> MADE FOR YOUR EVERYDAY</span>
            <h2>Style that<br /><em>speaks for you.</em></h2>
            <p>Find your next favourite, then make it completely your own.</p>
          </div>
          <div className="auth-brand-benefits">
            <div>
              <span className="auth-benefit-icon"><PackageCheck size={17} aria-hidden="true" /></span>
              <span><strong>Your orders, together</strong><small>Check every order in one place.</small></span>
            </div>
            <div>
              <span className="auth-benefit-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
              <span><strong>A little more personal</strong><small>Review the pieces you love.</small></span>
            </div>
          </div>
          <div className="auth-brand-signoff">
            <span className="auth-brand-mascot"><img src="/Logos/RacoonBro_raccoon_icon.png" alt="" /></span>
            <span><strong>YOUR STYLE. YOUR RULES.</strong><small>WEAR THE ATTITUDE</small></span>
          </div>
        </section>

        <section className="auth-form-panel">
          <header className="auth-form-heading">
            <span className="auth-form-kicker">{mode === "login" ? "MEMBER ACCESS" : "JOIN THE CREW"}</span>
            <h1 id="account-auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login"
              ? "Sign in to pick up right where you left off."
              : "A few details and you’re ready to make it yours."}</p>
          </header>

          <form className="account-form" onSubmit={submit} aria-labelledby="account-auth-title">
            {mode === "register" && (
              <>
                <div className="auth-field">
                  <label htmlFor="account-name">Full name</label>
                  <div className="auth-input-shell">
                    <UserRound className="auth-field-icon" size={17} aria-hidden="true" />
                    <input
                      id="account-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Your name"
                      required
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="account-phone">Phone number</label>
                  <div className="auth-input-shell">
                    <Phone className="auth-field-icon" size={17} aria-hidden="true" />
                    <input
                      id="account-phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="10-digit mobile number"
                      pattern="[6-9][0-9]{9}"
                      maxLength="10"
                      title="Enter a valid 10-digit Indian mobile number."
                      required
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="account-email">Email address</label>
                  <div className="auth-input-shell">
                    <Mail className="auth-field-icon" size={17} aria-hidden="true" />
                    <input
                      id="account-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      maxLength="254"
                      required
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value.trim() })}
                    />
                  </div>
                </div>
              </>
            )}

            {mode === "login" && (
              <div className="auth-field">
                <label htmlFor="account-identifier">Email or phone number</label>
                <div className="auth-input-shell">
                  <Mail className="auth-field-icon" size={17} aria-hidden="true" />
                  <input
                    id="account-identifier"
                    name="username"
                    autoComplete="username"
                    placeholder="Enter your email or phone"
                    required
                    value={form.identifier}
                    onChange={(event) => setForm({ ...form, identifier: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="account-password">Password</label>
              <div className="auth-input-shell auth-password-shell">
                <LockKeyhole className="auth-field-icon" size={17} aria-hidden="true" />
                <div className="account-password-field">
                  <input
                    id="account-password"
                    name="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    type={showPassword ? "text" : "password"}
                    minLength="8"
                    placeholder="At least 8 characters"
                    required
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                  />
                  <button type="button" className="password-visibility-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {mode === "register" && (
              <label className="auth-consent" htmlFor="account-marketing-consent">
                <input
                  id="account-marketing-consent"
                  type="checkbox"
                  checked={form.marketingConsent}
                  onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })}
                />
                <span>Send me product updates and offers</span>
              </label>
            )}

            {error && <p className="error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit">
              <span>{mode === "login" ? "Sign in to your account" : "Create my account"}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <div className="auth-mode-switch">
              <span>{mode === "login" ? "New to RacoonBro?" : "Already part of the crew?"}</span>
              <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </form>
          <Link className="auth-back-link" to="/">Continue shopping <ArrowRight size={14} aria-hidden="true" /></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page account-dashboard">
      <div className="account-head">
        <div className="account-welcome">
          <p className="eyebrow">YOUR RACOONBRO ACCOUNT</p>
          <h1>Welcome back, {String(customer.name || "there").split(" ")[0]}</h1>
          <p>
            {customer.phone}
            {customer.phone && customer.email && <span aria-hidden="true"> · </span>}
            {customer.email}
          </p>
        </div>
        <button className="account-signout" onClick={() => { setCustomerToken(null); setCustomer(null); setOrders([]); setReviews([]); }}>Sign out</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {searchParams.get("orderPlaced") && <p className="checkout-success" role="status">
        {searchParams.get("paymentMethod") === "cod"
          ? "Your cash-on-delivery order is placed. Pay the displayed order total at delivery."
          : "Payment confirmed — your order is placed."} You can follow its progress below.
      </p>}
      <section className="account-overview" aria-label="Account overview">
        <article className="account-overview-card">
          <span className="account-overview-icon"><PackageCheck size={18} /></span>
          <span><small>Orders placed</small><strong>{orders.length}</strong></span>
        </article>
        <article className="account-overview-card">
          <span className="account-overview-icon"><RotateCcw size={18} /></span>
          <span><small>Requests in review</small><strong>{orders.filter((order) => order.returnRequest?.status === "requested").length}</strong></span>
        </article>
        <Link className="account-overview-link" to="/refund-policy">
          <span><small>Need to return or exchange?</small><strong>View our 7-day policy</strong></span>
          <ArrowRight size={17} />
        </Link>
      </section>
      <section className="orders">
        <div className="account-section-heading">
          <div><p className="eyebrow">ORDER HISTORY</p><h2>Your orders</h2></div>
          <span>{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
        </div>
        {loadingOrders ? <p>Loading your orders…</p> : orders.length ? orders.map((order) => {
          const status = normalizedStatus(order.status);
          const phaseIndex = ORDER_PHASES.findIndex(([value]) => value === status);
          const cancelled = status === "cancelled_refund";
          const canCancel = canCancelOrder(status);
          return (
            <article className="order-row customer-order-card" key={order._id}>
              <div className="customer-order-heading">
                <div><strong>Order #{order._id.slice(-8).toUpperCase()}</strong><span>{new Date(order.createdAt).toLocaleDateString("en-IN")}</span></div>
                <div><strong>Rs. {Number(order.total || 0).toLocaleString("en-IN")}</strong><span className={`order-status status-${status}`}>{cancelled && order.paymentMethod === "cod" ? "Cancelled" : orderStatusLabel(status)}</span></div>
              </div>
              {order.codFee > 0 && <p className="customer-cod-fee">
                Cash on delivery · Items Rs. {Number(order.itemSubtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {order.couponDiscount > 0 && <> − Rs. {Number(order.couponDiscount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} coupon ({order.couponCode})</>}
                {" + "}Rs. {Number(order.codFee).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} handling fee
              </p>}
              {order.couponDiscount > 0 && order.codFee <= 0 && <p className="customer-cod-fee">
                Coupon {order.couponCode} · You saved Rs. {Number(order.couponDiscount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>}
              <div className={`order-phase-track${cancelled ? " is-cancelled" : ""}`} aria-label={`Order status: ${orderStatusLabel(status)}`}>
                {cancelled ? <strong>{order.paymentMethod === "cod" ? "Cancelled" : "Cancelled / Refund"}</strong> : ORDER_PHASES.map(([value, label], index) => (
                  <div key={value} className={`order-phase${index <= phaseIndex ? " is-complete" : ""}${index === phaseIndex ? " is-current" : ""}`}>
                    <i />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {cancelled && order.paymentMethod !== "cod" && <p className="cancelled-payment-note">Any eligible online-payment refund is handled manually; it is not issued automatically.</p>}
              {canCancel && (
                <div className="customer-order-cancel">
                  <div>
                    <strong>Changed your mind?</strong>
                    <span>Cancel any time before the store starts processing your order.</span>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(cancellingOrder)}
                    onClick={() => cancelOrder(order)}
                  >
                    <Ban size={15} aria-hidden="true" />
                    {cancellingOrder === order._id ? "Cancelling…" : "Cancel order"}
                  </button>
                  {cancelErrors[order._id] && <p className="error" role="alert">{cancelErrors[order._id]}</p>}
                </div>
              )}
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
              {order.returnRequest ? (
                <section className="customer-return-request">
                  <h3>{order.returnRequest.type === "exchange" ? "Exchange request" : "Return request"} · {order.returnRequest.status}</h3>
                  <p>{order.returnRequest.reason}</p>
                  {order.returnRequest.adminNote && <p><strong>Store response:</strong> {order.returnRequest.adminNote}</p>}
                </section>
              ) : status === "delivered" && canRequestReturn(order) ? (
                <form className="customer-return-request" onSubmit={(event) => { event.preventDefault(); submitReturnRequest(order); }}>
                  <h3>Return or exchange within 7 days</h3>
                  <p>Requests are reviewed by our team. This request does not automatically approve a refund or exchange.</p>
                  <label>Request type
                    <select
                      value={returnDrafts[order._id]?.type || "return"}
                      onChange={(event) => setReturnDrafts((current) => ({
                        ...current,
                        [order._id]: { type: event.target.value, reason: current[order._id]?.reason || "" },
                      }))}
                    >
                      <option value="return">Return</option>
                      <option value="exchange">Exchange</option>
                    </select>
                  </label>
                  <label>Reason
                    <textarea
                      required
                      minLength="5"
                      maxLength="1000"
                      value={returnDrafts[order._id]?.reason || ""}
                      onChange={(event) => setReturnDrafts((current) => ({
                        ...current,
                        [order._id]: { type: current[order._id]?.type || "return", reason: event.target.value },
                      }))}
                    />
                  </label>
                  {returnErrors[order._id] && <p className="error" role="alert">{returnErrors[order._id]}</p>}
                  <button type="submit" disabled={savingReturn === order._id}>
                    {savingReturn === order._id ? "Submitting…" : "Submit return / exchange request"}
                  </button>
                </form>
              ) : status === "delivered" ? (
                <p className="customer-return-window-closed">The 7-day return and exchange request window has ended.</p>
              ) : null}
            </article>
          );
        }) : <p>No orders yet.</p>}
      </section>
      <section className="order-help">
        <h2>Need help with your order?</h2>
        <p>Contact our team and share your order number for faster help.</p>
        <div>
          <a href="mailto:racoonbro777@gmail.com"><Mail size={17} /> racoonbro777@gmail.com</a>
        </div>
      </section>
    </main>
  );
}
