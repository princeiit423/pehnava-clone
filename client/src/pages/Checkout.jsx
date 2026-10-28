import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { clearCheckoutItem, readCheckoutItem } from "../utils/checkout.js";

const initialAddress = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
};
const PENDING_PAYMENT_KEY = "kcs_pending_payment";
const EXIT_REASONS = [
  ["payment_method", "My preferred payment method was unavailable"],
  ["technical_issue", "I had a technical problem"],
  ["changed_mind", "I changed my mind"],
  ["need_help", "I need help before paying"],
  ["other", "Other"],
];

function readPendingPayment() {
  try {
    const payment = JSON.parse(sessionStorage.getItem(PENDING_PAYMENT_KEY) || "null");
    return payment?.razorpay_order_id && payment?.razorpay_payment_id && payment?.razorpay_signature ? payment : null;
  } catch {
    return null;
  }
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const [item] = useState(readCheckoutItem);
  const [customer, setCustomer] = useState(null);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState("");
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [paying, setPaying] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(readPendingPayment);
  const [gatewayOrderId, setGatewayOrderId] = useState("");
  const [exitOutcome, setExitOutcome] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [exitDetails, setExitDetails] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const paymentFailureRef = useRef(false);

  useEffect(() => {
    api.get("/customers/me")
      .then(({ data }) => {
        setCustomer(data);
        setAddress((current) => ({
          ...current,
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
        }));
      })
      .catch((requestError) => {
        if (requestError.response?.status !== 401) {
          setError(requestError.response?.data?.message || "Unable to load your account.");
        }
      })
      .finally(() => setLoadingCustomer(false));
  }, []);

  async function confirmPayment(payment) {
    setPendingPayment(payment);
    setError("");
    setPaying(true);
    try {
      sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
      const { data: verification } = await api.post("/payments/razorpay/verify", payment);
      const { data: order } = await api.post("/orders", {
        paymentMethod: "razorpay",
        paymentIntentId: verification.paymentIntentId,
      });
      sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      clearCheckoutItem();
      navigate(`/account?orderPlaced=${encodeURIComponent(order._id)}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We couldn't finish confirming your order. Retry confirmation below; do not pay again.");
      setPaying(false);
    }
  }

  async function submitPaymentFeedback(event) {
    event.preventDefault();
    if (!gatewayOrderId || !exitOutcome || !exitReason) return;
    setPaying(true);
    try {
      await api.post("/payments/razorpay/feedback", {
        orderId: gatewayOrderId,
        outcome: exitOutcome,
        reason: exitReason,
        details: exitDetails,
      });
      setFeedbackSaved(true);
      setExitOutcome("");
      setExitReason("");
      setExitDetails("");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We couldn't save your feedback. Your checkout is still available.");
    } finally {
      setPaying(false);
    }
  }

  async function pay(event) {
    event.preventDefault();
    if (!item) {
      setError("Your checkout item has expired. Return to the product page and try again.");
      return;
    }
    setError("");
    setPaying(true);
    try {
      await loadRazorpay();
      const { data: gatewayOrder } = await api.post("/payments/razorpay/order", {
        items: [item],
        shippingAddress: address,
      });
      setGatewayOrderId(gatewayOrder.id);
      setFeedbackSaved(false);
      setExitOutcome("");
      setExitReason("");
      paymentFailureRef.current = false;
      const checkout = new window.Razorpay({
        key: gatewayOrder.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: gatewayOrder.name,
        description: gatewayOrder.description,
        order_id: gatewayOrder.id,
        prefill: { name: address.name, email: address.email, contact: address.phone },
        theme: { color: "#1b1b1b" },
        handler: confirmPayment,
        modal: {
          ondismiss: () => {
            setPaying(false);
            if (!paymentFailureRef.current) setExitOutcome("exited");
          },
        },
      });
      checkout.on("payment.failed", (response) => {
        paymentFailureRef.current = true;
        setError("The payment did not complete. If your bank or UPI app shows a debit, please don't pay again yet—contact support with your payment reference. Otherwise, you can safely retry.");
        setPaying(false);
        setExitOutcome("failed");
      });
      checkout.open();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to start payment. Please try again.");
      setPaying(false);
    }
  }

  return (
    <main className="account-page checkout-page">
      <p className="eyebrow">Secure checkout</p>
      <h1>Complete your order</h1>
      {!item ? (
        <section className="checkout-empty">
          <p>{error || "There is no item ready for checkout."}</p>
          <Link to="/collections/stitched-wear">Continue shopping</Link>
        </section>
      ) : (
        <div className="checkout-layout">
          <section className="checkout-panel">
            {loadingCustomer ? <p>Loading your account…</p> : customer ? (
              <form className="checkout-form" onSubmit={pay}>
                <h2>Shipping address</h2>
                <div className="checkout-fields">
                  <label>Full name<input autoComplete="name" required maxLength="100" value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} /></label>
                  <label>Phone number<input autoComplete="tel" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength="10" required value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
                  <label>Email address<input autoComplete="email" type="email" maxLength="254" value={address.email} onChange={(event) => setAddress({ ...address, email: event.target.value })} /></label>
                  <label className="checkout-address-field">Address<input autoComplete="street-address" required maxLength="250" value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} /></label>
                  <label>City<input autoComplete="address-level2" required maxLength="80" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
                  <label>State<input autoComplete="address-level1" required maxLength="80" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label>
                  <label>PIN code<input autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={address.pinCode} onChange={(event) => setAddress({ ...address, pinCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
                </div>
                {error && <p className="error" role="alert">{error}</p>}
                {exitOutcome && !feedbackSaved && (
                  <form className="payment-exit-survey" onSubmit={submitPaymentFeedback}>
                    <h3>{exitOutcome === "failed" ? "What went wrong?" : "Can you tell us why you left checkout?"}</h3>
                    <p>Your feedback helps us improve checkout. You can still retry your payment whenever you're ready.</p>
                    <fieldset>
                      <legend>Choose a reason</legend>
                      {EXIT_REASONS.map(([value, label]) => (
                        <label key={value}>
                          <input type="radio" name="payment-exit-reason" value={value} required checked={exitReason === value} onChange={() => setExitReason(value)} />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                    {exitReason === "other" && (
                      <label className="payment-exit-details">Anything else? (optional)
                        <textarea maxLength="500" rows="2" value={exitDetails} onChange={(event) => setExitDetails(event.target.value)} />
                      </label>
                    )}
                    <button type="submit" disabled={paying || !exitReason}>{paying ? "Saving…" : "Send feedback"}</button>
                    <button type="button" className="payment-exit-dismiss" onClick={() => setExitOutcome("")}>Not now</button>
                  </form>
                )}
                {feedbackSaved && <p className="payment-feedback-saved" role="status">Thanks for letting us know. Your checkout is still ready if you'd like to try again.</p>}
                {pendingPayment ? (
                  <button className="checkout-pay-button" type="button" disabled={paying} onClick={() => confirmPayment(pendingPayment)}>
                    {paying ? "Confirming payment…" : "Retry order confirmation"}
                  </button>
                ) : (
                  <button className="checkout-pay-button" type="submit" disabled={paying}>{paying ? "Opening secure payment…" : "Pay securely with Razorpay"}</button>
                )}
                {pendingPayment && <p className="checkout-security-note">A successful payment is waiting for confirmation. Retry here; do not start another payment.</p>}
                <p className="checkout-security-note">Your payment is processed securely by Razorpay. We never store your card or UPI credentials.</p>
              </form>
            ) : (
              <div className="checkout-login">
                <h2>Sign in to continue</h2>
                <p>Your order and delivery updates are saved to your account.</p>
                {error && <p className="error" role="alert">{error}</p>}
                <Link to="/account?checkout=1">Sign in or create an account</Link>
              </div>
            )}
          </section>
          <aside className="checkout-summary">
            <h2>Order summary</h2>
            <div className="checkout-summary-item">
              {item.image && <img src={item.image} alt="" />}
              <div><strong>{item.title}</strong><span>{[item.color, item.size].filter(Boolean).join(" · ") || "Standard option"}</span><span>Quantity: {item.quantity}</span></div>
            </div>
            <p><span>Payment</span><strong>Razorpay</strong></p>
            <p className="checkout-total"><span>Total</span><strong>Rs. {(Number(item.price || 0) * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
          </aside>
        </div>
      )}
    </main>
  );
}
