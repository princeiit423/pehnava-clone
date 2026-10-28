import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, setCustomerToken } from "../api.js";
import { Camera, Eye, EyeOff, MessageCircle, Mail, Star } from "lucide-react";

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
  const [reviewErrors, setReviewErrors] = useState({});
  const [savingReview, setSavingReview] = useState("");

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
    api.get("/orders")
      .then((res) => {
        if (!cancelled) setOrders(res.data);
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

  async function submitReview(order) {
    const draft = reviewDrafts[order._id] || { rating: 5, text: "" };
    setReviewErrors((current) => ({ ...current, [order._id]: "" }));
    setSavingReview(order._id);
    try {
      const response = await api.post(`/orders/${order._id}/review`, draft);
      setOrders((current) => current.map((item) => item._id === order._id ? { ...item, review: response.data.review } : item));
    } catch (err) {
      setReviewErrors((current) => ({ ...current, [order._id]: err.response?.data?.message || "Unable to submit your review." }));
    } finally {
      setSavingReview("");
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
        <button onClick={() => { setCustomerToken(null); setCustomer(null); setOrders([]); }}>Sign out</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {searchParams.get("orderPlaced") && <p className="checkout-success" role="status">Payment confirmed — your order is placed. You can follow its progress below.</p>}
      <section className="orders">
        <h2>Your orders</h2>
        {loadingOrders ? <p>Loading your orders…</p> : orders.length ? orders.map((order) => {
          const status = normalizedStatus(order.status);
          const phaseIndex = ORDER_PHASES.findIndex(([value]) => value === status);
          const cancelled = status === "cancelled_refund";
          const draft = reviewDrafts[order._id] || { rating: 5, text: "" };
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
                  <div className="customer-order-item" key={`${item.productId}-${index}`}>
                    {item.image && <img src={item.image} alt="" loading="lazy" />}
                    <span><strong>{item.title}</strong><small>{[item.color, item.size].filter(Boolean).join(" · ")}{item.quantity ? ` · Qty ${item.quantity}` : ""}</small></span>
                  </div>
                ))}
              </div>
              {(order.carrier || order.trackingNumber) && <p className="customer-tracking"><strong>Tracking:</strong> {order.carrier || "Carrier"}{order.trackingNumber ? ` · ${order.trackingNumber}` : ""}</p>}
              {order.editedAt && <p className="order-edited-note">Order information updated by store on {new Date(order.editedAt).toLocaleString("en-IN")}.</p>}
              {order.review ? (
                <div className="submitted-order-review"><strong>Your review submitted</strong><span>{"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}</span><p>{order.review.text}</p></div>
              ) : status === "delivered" && (
                <div className="order-review-form">
                  <h3>Review your order</h3>
                  <label>Rating
                    <select value={draft.rating} onChange={(event) => setReviewDrafts((current) => ({ ...current, [order._id]: { ...draft, rating: Number(event.target.value) } }))}>
                      {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}
                    </select>
                  </label>
                  <textarea maxLength="1000" rows="3" placeholder="Share your experience" value={draft.text} onChange={(event) => setReviewDrafts((current) => ({ ...current, [order._id]: { ...draft, text: event.target.value } }))} />
                  {reviewErrors[order._id] && <p className="error" role="alert">{reviewErrors[order._id]}</p>}
                  <button type="button" disabled={savingReview === order._id} onClick={() => submitReview(order)}>{savingReview === order._id ? "Submitting…" : "Submit review"}</button>
                </div>
              )}
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
