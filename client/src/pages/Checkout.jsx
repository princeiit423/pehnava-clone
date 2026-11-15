import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { clearCheckoutItem, isCartCheckout, readCheckoutItems, readCheckoutRequestId } from "../utils/checkout.js";
import { useCart } from "../context/CartContext.jsx";

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
  const [items] = useState(readCheckoutItems);
  const [checkoutRequestId] = useState(readCheckoutRequestId);
  const [fromCart] = useState(isCartCheckout);
  const { removeItems } = useCart();
  const [customer, setCustomer] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState({});
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
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
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const paymentFailureRef = useRef(false);
  const checkoutSubtotal = Number(items.reduce((total, item) => {
    const product = catalogProducts[item.productId];
    return total + Number(product?.salePrice ?? product?.price ?? item.price ?? 0) * item.quantity;
  }, 0).toFixed(2));
  const itemsSubtotal = Number(appliedCoupon?.itemSubtotal ?? checkoutSubtotal);
  const couponDiscount = Number(appliedCoupon?.discountAmount || 0);
  const discountedSubtotal = Math.max(0, Number((itemsSubtotal - couponDiscount).toFixed(2)));
  const codHandlingFee = Number((discountedSubtotal * 0.04).toFixed(2));
  const checkoutTotal = Number((discountedSubtotal + (paymentMethod === "cod" ? codHandlingFee : 0)).toFixed(2));
  const allProductsLoaded = items.length > 0 && items.every((item) => Boolean(catalogProducts[item.productId] && !catalogProducts[item.productId].loadError));
  const codEligible = allProductsLoaded && items.every((item) => catalogProducts[item.productId].codEligible !== false);

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    Promise.all([...new Set(items.map((item) => item.productId))].map(async (productId) => {
      try {
        const { data } = await api.get(`/products/${encodeURIComponent(productId)}`);
        return [productId, data];
      } catch (requestError) {
        return [productId, { loadError: requestError.response?.data?.message || "Unable to load current product details." }];
      }
    })).then((entries) => {
      if (cancelled) return;
      const products = Object.fromEntries(entries);
      setCatalogProducts(products);
      if (Object.values(products).some((product) => product.loadError)) {
        setError("One or more products could not be loaded. Return to your cart and try again.");
      }
      if (Object.values(products).some((product) => product.codEligible === false)) {
        setPaymentMethod("razorpay");
      }
    });
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    api.get("/customers/me")
      .then(({ data }) => {
        setCustomer(data);
        setAddress((current) => ({
          ...current,
          ...(data.shippingAddress || {}),
          name: data.shippingAddress?.name || data.name || "",
          phone: data.shippingAddress?.phone || data.phone || "",
          email: data.shippingAddress?.email || data.email || "",
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
      if (fromCart) removeItems(items);
      navigate(`/account?orderPlaced=${encodeURIComponent(order._id)}&paymentMethod=razorpay`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We couldn't finish confirming your order. Retry confirmation below; do not pay again.");
      setPaying(false);
    }
  }

  async function applyCoupon(event) {
    event.preventDefault();
    const code = couponCode.trim();
    if (!code || !items.length) {
      setCouponError("Enter a coupon code.");
      return;
    }

    setCouponError("");
    setValidatingCoupon(true);
    try {
      const { data } = await api.post("/coupons/validate", {
        code,
        items,
      });
      setAppliedCoupon(data);
      setCouponCode(data.code);
    } catch (requestError) {
      setAppliedCoupon(null);
      setCouponError(requestError.response?.data?.message || "Unable to validate this coupon.");
    } finally {
      setValidatingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
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
    if (!items.length) {
      setError("Your checkout items have expired. Return to the cart and try again.");
      return;
    }
    setError("");
    setPaying(true);
    try {
      if (!allProductsLoaded) {
        throw new Error("Current product details are not available. Refresh checkout and try again.");
      }
      const { data: savedAddress } = await api.put("/customers/me/shipping-address", address);
      setAddress(savedAddress.shippingAddress);
      if (paymentMethod === "cod") {
        const { data: order } = await api.post("/orders", {
          paymentMethod: "cod",
          checkoutId: checkoutRequestId,
          couponCode: appliedCoupon?.code || "",
          items,
          shippingAddress: savedAddress.shippingAddress,
        });
        clearCheckoutItem();
        if (fromCart) removeItems(items);
        navigate(`/account?orderPlaced=${encodeURIComponent(order._id)}&paymentMethod=cod`);
        return;
      }
      await loadRazorpay();
      const { data: gatewayOrder } = await api.post("/payments/razorpay/order", {
        items,
        shippingAddress: savedAddress.shippingAddress,
        couponCode: appliedCoupon?.code || "",
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
      {!items.length ? (
        <section className="checkout-empty">
          <p>{error || "There is no item ready for checkout."}</p>
          <Link to={fromCart ? "/cart" : "/collections/stitched-wear"}>{fromCart ? "Return to cart" : "Continue shopping"}</Link>
        </section>
      ) : (
        <div className="checkout-layout">
          <section className="checkout-panel">
            {loadingCustomer ? <p>Loading your account…</p> : customer ? (
              <form className="checkout-form" onSubmit={pay}>
                <h2>Shipping address</h2>
                <p className="checkout-security-note">Your address is saved to your account for future checkouts. You can update it here anytime.</p>
                <div className="checkout-fields">
                  <label>Full name<input autoComplete="name" required maxLength="100" value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} /></label>
                  <label>Phone number<input autoComplete="tel" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength="10" required value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
                  <label>Email address<input autoComplete="email" type="email" maxLength="254" value={address.email} onChange={(event) => setAddress({ ...address, email: event.target.value })} /></label>
                  <label className="checkout-address-field">Address<input autoComplete="street-address" required maxLength="250" value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} /></label>
                  <label>City<input autoComplete="address-level2" required maxLength="80" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
                  <label>State<input autoComplete="address-level1" required maxLength="80" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label>
                  <label>PIN code<input autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={address.pinCode} onChange={(event) => setAddress({ ...address, pinCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
                </div>
                {!pendingPayment && (
                  <section className="checkout-coupon" aria-label="Coupon code">
                    <h2>Discount code</h2>
                    {appliedCoupon ? (
                      <div className="checkout-coupon-applied" role="status">
                        <span><strong>{appliedCoupon.code}</strong> applied — you save Rs. {couponDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <button type="button" onClick={removeCoupon} disabled={paying}>Remove</button>
                      </div>
                    ) : (
                      <div className="checkout-coupon-form">
                        <label htmlFor="checkout-coupon-code">Coupon code</label>
                        <div>
                          <input
                            id="checkout-coupon-code"
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                            maxLength="32"
                            autoComplete="off"
                            disabled={paying}
                          />
                          <button type="button" onClick={applyCoupon} disabled={paying || validatingCoupon || !couponCode.trim()}>
                            {validatingCoupon ? "Checking…" : "Apply"}
                          </button>
                        </div>
                      </div>
                    )}
                    {couponError && <p className="error" role="alert">{couponError}</p>}
                  </section>
                )}
                {!pendingPayment && (
                  <fieldset className="checkout-payment-options">
                    <legend>Payment method</legend>
                    <label>
                      <input type="radio" name="checkout-payment-method" value="razorpay" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                      <span><strong>Pay online</strong><small>Secure payment through Razorpay. No COD handling fee.</small></span>
                    </label>
                    {codEligible ? (
                      <label>
                        <input type="radio" name="checkout-payment-method" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                        <span><strong>Cash on delivery</strong><small>A cash-handling charge is added to the order total. Prefer to pay online? Choose online payment to avoid it.</small></span>
                      </label>
                    ) : (
                      <p className="checkout-cod-unavailable" role="status">
                        {allProductsLoaded
                          ? "Cash on delivery is not available for one or more products in this order. Choose online payment instead."
                          : "Checking product payment options…"}
                      </p>
                    )}
                  </fieldset>
                )}
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
                  <button className="checkout-pay-button" type="submit" disabled={paying || !allProductsLoaded}>
                    {paying
                      ? paymentMethod === "cod" ? "Placing COD order…" : "Opening secure payment…"
                      : paymentMethod === "cod" ? "Place cash on delivery order" : "Pay securely with Razorpay"}
                  </button>
                )}
                {pendingPayment && <p className="checkout-security-note">A successful payment is waiting for confirmation. Retry here; do not start another payment.</p>}
                {paymentMethod === "razorpay" && <p className="checkout-security-note">Your payment is processed securely by Razorpay. We never store your card or UPI credentials.</p>}
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
            {items.map((item, index) => {
              const product = catalogProducts[item.productId];
              return (
                <div className="checkout-summary-item" key={`${item.productId}-${item.color || ""}-${item.size || ""}-${index}`}>
                  {(product?.images?.[0] || item.image) && <img src={product?.images?.[0] || item.image} alt="" />}
                  <div>
                    <strong>{product?.title || item.title}</strong>
                    <span>{[item.color, item.size].filter(Boolean).join(" · ") || "Standard option"}</span>
                    <span>Quantity: {item.quantity}</span>
                    <span>Rs. {Number(product?.salePrice ?? product?.price ?? item.price ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</span>
                  </div>
                </div>
              );
            })}
            <p><span>Payment</span><strong>{paymentMethod === "cod" ? "Cash on delivery" : "Online payment"}</strong></p>
            <p><span>Shipping</span><strong>Free</strong></p>
            <p><span>Items subtotal</span><strong>Rs. {itemsSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            {couponDiscount > 0 && <p className="checkout-discount-row"><span>Coupon ({appliedCoupon.code})</span><strong>− Rs. {couponDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>}
            {paymentMethod === "cod" && <p><span>Cash-handling charge</span><strong>Rs. {codHandlingFee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>}
            <p className="checkout-total"><span>Total</span><strong>Rs. {checkoutTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            <div className="checkout-help-note">
              <strong>Need a hand before paying?</strong>
              <Link to="/contact">Contact RacoonBro support</Link>
            </div>
            <p className="checkout-policy-note">
              All products can be requested for return or exchange within 7 days after delivery. Review our{" "}
              <Link to="/refund-policy">return and exchange policy</Link>{" "}
              before placing your order.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
