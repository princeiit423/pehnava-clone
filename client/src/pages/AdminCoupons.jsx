import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../api.js";
import "./AdminDashboard.css";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function localDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function defaultForm() {
  const startsAt = localDateTime();
  const expiresAt = localDateTime(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: "",
    discountType: "percentage",
    discountValue: "",
    minimumOrderAmount: "0",
    maximumDiscount: "",
    startsAt,
    expiresAt,
    active: true,
  };
}

function couponForm(coupon) {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    minimumOrderAmount: String(coupon.minimumOrderAmount || 0),
    maximumDiscount: coupon.maximumDiscount == null ? "" : String(coupon.maximumDiscount),
    startsAt: localDateTime(coupon.startsAt),
    expiresAt: localDateTime(coupon.expiresAt),
    active: coupon.active === true,
  };
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminCoupons() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("kcs_admin_token")) {
      navigate("/admin");
      return;
    }

    api.get("/coupons")
      .then(({ data }) => setCoupons(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Unable to load coupons."))
      .finally(() => setLoading(false));
  }, [navigate]);

  function generateCode() {
    if (!window.crypto?.getRandomValues) {
      setError("Secure coupon generation is unavailable in this browser.");
      return;
    }
    const bytes = new Uint8Array(10);
    window.crypto.getRandomValues(bytes);
    setForm((current) => ({
      ...current,
      code: Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join(""),
    }));
    setError("");
  }

  function resetForm() {
    setEditingId("");
    setForm(defaultForm());
    setError("");
    setMessage("");
  }

  async function saveCoupon(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
      };
      const response = editingId
        ? await api.put(`/coupons/${editingId}`, payload)
        : await api.post("/coupons", payload);
      setCoupons((current) => [
        response.data,
        ...current.filter((coupon) => coupon._id !== response.data._id),
      ]);
      setMessage(editingId ? "Coupon updated." : "Coupon created.");
      setEditingId("");
      setForm(defaultForm());
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to save coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}? Customers will no longer be able to apply it.`)) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/coupons/${coupon._id}`);
      setCoupons((current) => current.filter((entry) => entry._id !== coupon._id));
      if (editingId === coupon._id) resetForm();
      setMessage(`${coupon.code} deleted.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete coupon.");
    }
  }

  function logout() {
    setAdminToken(null);
    navigate("/admin");
  }

  return (
    <main className="admin-dashboard coupon-admin">
      <div className="admin-head">
        <div><p className="eyebrow">Store promotions</p><h1>Coupons</h1></div>
        <div className="homepage-admin-actions">
          <Link to="/admin/dashboard">Back to dashboard</Link>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <form className="coupon-editor homepage-admin-section" onSubmit={saveCoupon}>
        <div className="homepage-admin-section-head">
          <div>
            <h2>{editingId ? "Edit coupon" : "Create a coupon"}</h2>
            <p>Coupons are created and managed here. A coupon is usable only while active and inside its validity window.</p>
          </div>
          {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
        <div className="homepage-admin-grid">
          <label className="store-settings-field">Coupon code
            <div className="coupon-code-field">
              <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} maxLength="32" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" required />
              <button type="button" onClick={generateCode}>Generate</button>
            </div>
          </label>
          <label className="store-settings-field">Discount type
            <select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value, maximumDiscount: event.target.value === "fixed" ? "" : form.maximumDiscount })}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount (Rs.)</option>
            </select>
          </label>
          <label className="store-settings-field">Discount value
            <input type="number" min="0.01" max={form.discountType === "percentage" ? "100" : undefined} step="0.01" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} required />
          </label>
          <label className="store-settings-field">Minimum order amount (Rs.)
            <input type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={(event) => setForm({ ...form, minimumOrderAmount: event.target.value })} required />
          </label>
          {form.discountType === "percentage" && (
            <label className="store-settings-field">Maximum discount (optional, Rs.)
              <input type="number" min="0.01" step="0.01" value={form.maximumDiscount} onChange={(event) => setForm({ ...form, maximumDiscount: event.target.value })} />
            </label>
          )}
          <label className="store-settings-field">Valid from
            <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
          </label>
          <label className="store-settings-field">Valid until
            <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} required />
          </label>
        </div>
        <label className="store-settings-checkbox">
          <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
          Coupon is active
        </label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create coupon"}</button>
      </form>

      <section className="homepage-admin-section">
        <h2>Existing coupons</h2>
        {loading ? <p>Loading coupons…</p> : !coupons.length ? <p>No coupons have been created.</p> : (
          <div className="coupon-list">
            {coupons.map((coupon) => (
              <article className="homepage-admin-card coupon-card" key={coupon._id}>
                <div>
                  <strong className="coupon-card-code">{coupon.code}</strong>
                  <p>{coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `Rs. ${Number(coupon.discountValue).toLocaleString("en-IN")} off`}</p>
                  {coupon.minimumOrderAmount > 0 && <p>Minimum order: Rs. {Number(coupon.minimumOrderAmount).toLocaleString("en-IN")}</p>}
                  {coupon.maximumDiscount != null && <p>Maximum discount: Rs. {Number(coupon.maximumDiscount).toLocaleString("en-IN")}</p>}
                  <p>Valid {formatDate(coupon.startsAt)} – {formatDate(coupon.expiresAt)}</p>
                </div>
                <div className="coupon-card-actions">
                  <span className={`coupon-status${coupon.active ? " is-active" : ""}`}>{coupon.active ? "Active" : "Inactive"}</span>
                  <button type="button" onClick={() => { setEditingId(coupon._id); setForm(couponForm(coupon)); setError(""); setMessage(""); }}>Edit</button>
                  <button type="button" onClick={() => deleteCoupon(coupon)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
