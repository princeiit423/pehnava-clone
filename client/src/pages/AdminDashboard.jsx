import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../api.js";
import { CATEGORIES } from "../categories.js";
import { Bell, Mail, MessageCircle, Printer } from "lucide-react";
import { downloadReportPdf, downloadReportPng } from "../utils/adminExports.js";
import { useToast } from "../components/Toast.jsx";
import "./AdminOrderPrint.css";
import "./AdminOrderNotifications.css";

const EMPTY = {
  title: "",
  sku: "",
  price: "",
  discount: 0,
  stock: 1,
  images: "",
  type: "Stitched/Ready to Wear",
  fabric: "Cotton",
  dupatta: "Cotton",
  colorsText: "",
  sizesText: "Free Size",
  categories: [],
  soldOut: false,
  isNew: true,
  description: "",
  careGuide: "Dry wash only.",
  shipping:
    "Free shipping all over India. Dispatched in 3-5 days.",
  variantStockText: "",
};

const SIZE_OPTIONS = [
  "Free Size",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "Unstitched",
  "Custom",
];

const COLOR_PALETTE = [
  ["Black", "#111111"],
  ["White", "#f5f5f5"],
  ["Red", "#a51b2b"],
  ["Maroon", "#7a1f2b"],
  ["Pink", "#e91e63"],
  ["Orange", "#e08a1e"],
  ["Yellow", "#e6c62f"],
  ["Green", "#237a50"],
  ["Blue", "#1c4e9e"],
  ["Navy", "#16213e"],
  ["Purple", "#6b3f92"],
  ["Beige", "#e7d9c2"],
  ["Cream", "#f4ede1"],
  ["Grey", "#8a8a8a"],
];

function hasValidCustomerPhone(value) {
  return /^[6-9]\d{9}$/.test(String(value || ""));
}

function hasValidCustomerEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "")) && String(value).length <= 254;
}

function customerDisplayId(customer) {
  return customer.customerId || `CUS-${String(customer._id || "").toUpperCase()}`;
}

function filterRecordsByDate(records, filter) {
  if (!filter || filter.period === "all") return records;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null;
  let end = new Date(today);

  if (filter.period === "today") start = today;
  if (filter.period === "this_week") {
    start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  }
  if (filter.period === "this_month") start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (filter.period === "this_year") start = new Date(today.getFullYear(), 0, 1);
  if (filter.period === "last_year") {
    start = new Date(today.getFullYear() - 1, 0, 1);
    end = new Date(today.getFullYear() - 1, 11, 31);
  }
  if (filter.period === "custom") {
    start = filter.start ? new Date(`${filter.start}T00:00:00`) : null;
    end = filter.end ? new Date(`${filter.end}T23:59:59.999`) : null;
  } else {
    end.setHours(23, 59, 59, 999);
  }

  return records.filter((record) => {
    const created = new Date(record.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return (!start || created >= start) && (!end || created <= end);
  });
}

function normalizedOrderStatus(status) {
  return ({
    pending: "order_placed",
    paid: "payment_confirmed",
    processing: "processing_packed",
    cancelled: "cancelled_refund",
  })[status] || status || "order_placed";
}

function formatPaymentMethod(method) {
  const labels = {
    cod: "Cash on delivery",
    phonepe: "PhonePe",
    razorpay: "Razorpay",
    "phonepe-manual": "PhonePe (manual)",
    "razorpay-manual": "Razorpay (manual)",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
  };
  if (labels[method]) return labels[method];

  return String(method || "Not recorded")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function manualOrderStock(product, color, size) {
  if (!product) return 0;

  if (product.variantStock?.length) {
    const variant = product.variantStock.find(
      (item) => item.color === color && item.size === size
    );
    return Math.max(0, Number(variant?.stock) || 0);
  }

  if (product.colors?.length && color) {
    const productColor = product.colors.find(
      (item) => (item.name || item) === color
    );
    return Math.max(0, Number(productColor?.stock ?? product.stock ?? 0) || 0);
  }

  return Math.max(0, Number(product.stock) || 0);
}

function ReportDateFilter({ value, onChange, label }) {
  function update(field, nextValue) {
    onChange({ ...value, [field]: nextValue });
  }
  return (
    <div className="report-date-filter">
      <label>{label}
        <select value={value.period} onChange={(event) => update("period", event.target.value)}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="this_year">This year</option>
          <option value="last_year">Last year</option>
          <option value="custom">Custom dates</option>
        </select>
      </label>
      {value.period === "custom" && <>
        <label>From<input type="date" value={value.start} onChange={(event) => update("start", event.target.value)} /></label>
        <label>To<input type="date" value={value.end} onChange={(event) => update("end", event.target.value)} /></label>
      </>}
    </div>
  );
}

export default function AdminDashboard() {
  const showToast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const knownOrderIds = useRef(null);
  const [products, setProducts] = useState([]);
  const [storefrontCategories, setStorefrontCategories] = useState(CATEGORIES);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentFeedback, setPaymentFeedback] = useState([]);

  const [tableSearch, setTableSearch] = useState({
    products: "",
    orders: "",
    customers: "",
  });

  const [pages, setPages] = useState({
    products: 1,
    orders: 1,
    customers: 1,
  });

  const [productSearch, setProductSearch] =
    useState("");
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [orderAddressDraft, setOrderAddressDraft] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", email: "" });
  const [newCustomerDraft, setNewCustomerDraft] = useState({ name: "", phone: "", email: "" });
  const [reportFilters, setReportFilters] = useState({
    orders: { period: "all", start: "", end: "" },
    customers: { period: "all", start: "", end: "" },
  });
  const [salesPeriod, setSalesPeriod] = useState("today");
  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd] = useState("");
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [productPreview, setProductPreview] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingManualOrder, setSavingManualOrder] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(
    () => typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  const [expandedOrder, setExpandedOrder] =
    useState(() => new URLSearchParams(location.search).get("order"));
  const [printOrder, setPrintOrder] = useState(null);

  const [colorRows, setColorRows] = useState([]);
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#8a8a8a");
  const [customSizeName, setCustomSizeName] = useState("");
  const [customSizes, setCustomSizes] = useState([]);
  const [variantRows, setVariantRows] = useState([]);
  const [stockTotalDraft, setStockTotalDraft] = useState(null);
  const [stockAdjustmentTarget, setStockAdjustmentTarget] = useState("");
  const colorStockTotal = (color) => {
    const colorVariants = variantRows.filter((variant) => variant.color === color.name);
    return colorVariants.length
      ? colorVariants.reduce((total, variant) => total + Math.max(0, Number(variant.stock) || 0), 0)
      : Math.max(0, Number(color.stock) || 0);
  };
 const [manualOrder, setManualOrder] = useState({
  customerId: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  productId: "",
  title: "",
  price: "",
  color: "",
  size: "",
  quantity: 1,
  paymentMethod: "whatsapp",
  source: "whatsapp"
});

  const [form, setForm] = useState(EMPTY);
  const sizeOptions = Array.from(new Set([
    ...SIZE_OPTIONS,
    ...form.sizesText.split(/[,\n]/).map((size) => size.trim()).filter(Boolean),
  ]));
  const [editingId, setEditingId] =
    useState(null);

  const productStockTotal = colorRows.length
    ? colorRows.reduce((total, color) => total + colorStockTotal(color), 0)
    : Math.max(0, Number(form.stock) || 0);
  const stockAdjustmentOptions = variantRows.length
    ? variantRows.map((variant) => ({
        value: `variant:${variant.color}::${variant.size}`,
        label: `${variant.color} / ${variant.size} (${variant.stock} pieces)`,
      }))
    : colorRows.map((color) => ({
        value: `color:${color.name}`,
        label: `${color.name} (${color.stock} pieces)`,
      }));
  const activeStockAdjustmentTarget = stockAdjustmentOptions.some((option) => option.value === stockAdjustmentTarget)
    ? stockAdjustmentTarget
    : stockAdjustmentOptions[0]?.value || "";

  const [error, setError] = useState("");
  const tagCategories = storefrontCategories.filter((category) => category.type === "tag" && category.active !== false)
    .map((category) => ({ ...category, tag: category.productTag || category.tag }));
  const manualProduct = products.find((product) => product._id === manualOrder.productId);
  const manualCustomer = customers.find((customer) => customer._id === manualOrder.customerId);
  const manualVariants = manualProduct?.variantStock || [];
  const manualHasColors = Boolean(manualVariants.length || manualProduct?.colors?.length);
  const manualColorOptions = manualVariants.length
    ? [...new Set(manualVariants
        .filter((variant) => variant.color && Number(variant.stock) > 0)
        .map((variant) => variant.color))]
    : (manualProduct?.colors || [])
        .filter((color) => Number(color.stock ?? manualProduct?.stock ?? 0) > 0)
        .map((color) => color.name || color);
  const manualSizeOptions = manualVariants.length
    ? [...new Set(manualVariants
        .filter((variant) => variant.color === manualOrder.color && Number(variant.stock) > 0)
        .map((variant) => variant.size)
        .filter(Boolean))]
    : (manualProduct?.sizes?.length ? manualProduct.sizes : ["Free Size"]);
  const manualMaxStock = manualOrderStock(manualProduct, manualOrder.color, manualOrder.size);

  const adminPage = location.pathname.endsWith("/dashboard")
    ? "overview"
    : location.pathname.endsWith("/orders")
      ? "orders"
      : location.pathname.endsWith("/customers")
        ? "customers"
        : location.pathname.endsWith("/sales")
          ? "sales"
          : location.pathname.endsWith("/add-product")
            ? "add-product"
            : "products";
  const inventory = products.map((product) => {
    const stock = product.variantStock?.length
      ? product.variantStock.reduce((total, variant) => total + Math.max(0, Number(variant.stock) || 0), 0)
      : product.colors?.length
        ? product.colors.reduce((total, color) => total + Math.max(0, Number(color.stock) || 0), 0)
        : Math.max(0, Number(product.stock) || 0);
    const categories = product.categories?.length ? product.categories : ["uncategorized"];
    return { ...product, inventoryStock: stock, inventoryCategories: categories };
  });
  const categoryOptions = [...new Set(inventory.flatMap((product) => product.inventoryCategories))].sort();
  const visibleInventory = inventory.filter((product) =>
    inventoryCategory === "all" || product.inventoryCategories.includes(inventoryCategory)
  );
  const outOfStockCount = inventory.filter((product) => product.inventoryStock <= 0).length;
  const totalUnitsInStock = inventory.reduce((total, product) => total + product.inventoryStock, 0);
  const confirmedStatuses = new Set(["paid", "payment_confirmed", "processing", "processing_packed", "shipped", "out_for_delivery", "delivered"]);
  const totalSales = orders.reduce(
    (total, order) => total + (confirmedStatuses.has(order.status) ? Number(order.total) || 0 : 0),
    0
  );
  const salesFilter = { period: salesPeriod, start: salesStart, end: salesEnd };
  const salesHistoryOrders = filterRecordsByDate(orders, salesFilter);
  const salesHistoryTotal = salesHistoryOrders.reduce(
    (total, order) => total + (confirmedStatuses.has(order.status) ? Number(order.total) || 0 : 0),
    0
  );
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthlyOrders = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return confirmedStatuses.has(order.status)
      && !Number.isNaN(createdAt.getTime())
      && createdAt >= monthStart
      && createdAt < nextMonthStart;
  });
  const monthlyOrderValue = monthlyOrders.reduce((total, order) => total + (Number(order.total) || 0), 0);
  const activeOrders = orders.filter((order) => !["delivered", "cancelled_refund"].includes(normalizedOrderStatus(order.status)));
  const attentionOrders = activeOrders
    .filter((order) => ["order_placed", "payment_confirmed", "processing_packed", "out_for_delivery"].includes(normalizedOrderStatus(order.status)))
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(0, 6);
  const lowStockProducts = inventory
    .filter((product) => product.inventoryStock <= 5)
    .sort((left, right) => left.inventoryStock - right.inventoryStock)
    .slice(0, 6);
  const bestSellingProducts = (() => {
    const totals = new Map();
    for (const order of orders) {
      if (!confirmedStatuses.has(order.status)) continue;
      for (const item of order.items || []) {
        const key = item.productId || item.title;
        if (!key) continue;
        const record = totals.get(key) || { title: item.title || "Product", quantity: 0 };
        record.quantity += Math.max(0, Number(item.quantity) || 0);
        totals.set(key, record);
      }
    }
    return [...totals.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5);
  })();
  const statusLabels = {
    order_placed: "Order placed",
    payment_confirmed: "Payment confirmed",
    processing_packed: "Processing / packed",
    shipped: "Shipped",
    out_for_delivery: "Out for delivery",
  };

  function filteredReportRecords(type, records) {
    return filterRecordsByDate(records, reportFilters[type]);
  }

  function customerExportRows() {
    return filteredReportRecords("customers", customers).map((customer) => [
      customerDisplayId(customer),
      customer.name || "",
      hasValidCustomerPhone(customer.phone) ? customer.phone : "Needs correction",
      hasValidCustomerEmail(customer.email) ? customer.email : "Needs correction",
      customer.marketingConsent ? "Opted in" : "Not opted in",
      customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN") : "",
    ]);
  }

  function orderExportRows() {
    return filteredReportRecords("orders", orders).map((order) => [
      `#${String(order._id || "").slice(-8).toUpperCase()}`,
      order.shippingAddress?.name || order.customer?.name || "",
      order.shippingAddress?.phone || order.customer?.phone || "",
      (order.items || []).map((item) => `${item.title} × ${item.quantity}`).join("; "),
      `Rs. ${Number(order.total || 0).toLocaleString("en-IN")}`,
      order.status || "",
      order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : "",
    ]);
  }

  function exportReport(format, title, columns, rows) {
    if (format === "pdf") downloadReportPdf(title, columns, rows);
    else downloadReportPng(title, columns, rows);
  }


  // ============================================================
  // LOAD PRODUCTS
  // ============================================================

  function loadProducts() {
    api
      .get("/products")
      .then((res) => {
        setProducts(res.data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            "Unable to load products"
        );
      });
  }


  // ============================================================
  // LOAD ADMIN DATA
  // ============================================================

  function loadAdminData() {
    Promise.all([
      api.get("/admin/orders"),
      api.get("/admin/customers"),
      api.get("/admin/payment-feedback"),
      api.get("/reviews/admin"),
    ])
      .then(
        ([
          ordersResponse,
          customersResponse,
          paymentFeedbackResponse,
          reviewsResponse,
        ]) => {
            if (!knownOrderIds.current) {
              knownOrderIds.current = new Set(ordersResponse.data.map((order) => order._id));
            }
            setOrders(ordersResponse.data);
          setCustomers(
            customersResponse.data
          );
          setPaymentFeedback(paymentFeedbackResponse.data);
          setReviews(reviewsResponse.data);
        }
      )
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            "Unable to load admin data"
        );
      });
  }

  async function deleteCustomerReview(review) {
    if (!window.confirm("Delete this customer review and its uploaded images?")) return;
    try {
      const response = await api.delete(`/reviews/admin/${review._id}`);
      setReviews((current) => current.filter((item) => item._id !== review._id));
      setError("");
      showToast(response.data.warning || "Customer review deleted.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete customer review.");
    }
  }


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const token =
      localStorage.getItem(
        "kcs_admin_token"
      );

    if (!token) {
      navigate("/admin");
      return;
    }

    api.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${token}`;

    loadProducts();
    loadAdminData();
    api.get("/storefront-settings")
      .then((response) => {
        if (Array.isArray(response.data?.categories)) {
          setStorefrontCategories(response.data.categories);
        }
      })
      .catch((loadError) => {
        console.error("Unable to load storefront categories:", loadError);
      });

    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("kcs_admin_token")) return undefined;

    let active = true;
    let requestInProgress = false;
    let pollFailureReported = false;

    async function checkForNewOrders() {
      if (requestInProgress) return;
      requestInProgress = true;

      try {
        const response = await api.get("/admin/orders");
        if (!active) return;
        if (!Array.isArray(response.data)) {
          throw new Error("The new-order check returned an invalid response.");
        }

        const receivedOrders = response.data;
        if (!knownOrderIds.current) {
          knownOrderIds.current = new Set(receivedOrders.map((order) => order._id));
          setOrders(receivedOrders);
          pollFailureReported = false;
          return;
        }

        const knownIds = knownOrderIds.current;
        const newOrders = receivedOrders.filter((order) => !knownIds.has(order._id));
        receivedOrders.forEach((order) => knownIds.add(order._id));
        setOrders(receivedOrders);

        if (newOrders.length) {
          const title = newOrders.length === 1 ? "New order received" : `${newOrders.length} new orders received`;
          const details = newOrders.slice(0, 3).map((order) =>
            `#${order._id.slice(-8).toUpperCase()} — ${order.shippingAddress?.name || order.customer?.name || "Customer"}`
          );
          const body = [
            ...details,
            newOrders.length > details.length ? `and ${newOrders.length - details.length} more` : "",
          ].filter(Boolean).join("\n");

          showToast(`${title}: ${details.join("; ")}`);
          if (notificationPermission === "granted") {
            try {
              new Notification(title, { body, tag: `new-orders-${newOrders[0]._id}` });
            } catch (notificationError) {
              console.error("Unable to show browser notification for new order:", notificationError);
            }
          }
        }

        pollFailureReported = false;
      } catch (pollError) {
        if (!active) return;
        if (!pollFailureReported) {
          console.error("Unable to check for new admin orders:", pollError);
          showToast("Unable to check for new orders. Please check your connection.");
          pollFailureReported = true;
        }
      } finally {
        requestInProgress = false;
      }
    }

    const intervalId = window.setInterval(checkForNewOrders, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [notificationPermission, showToast]);

  useEffect(() => {
    if (!printOrder) return undefined;

    const handleAfterPrint = () => setPrintOrder(null);
    window.addEventListener("afterprint", handleAfterPrint);
    const printFrame = window.requestAnimationFrame(() => window.print());

    return () => {
      window.cancelAnimationFrame(printFrame);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printOrder]);


  // ============================================================
  // LOGOUT
  // ============================================================

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        showToast("Browser notifications enabled for new orders.");
      } else {
        showToast("Browser notifications were not enabled. In-dashboard alerts will still appear while this page is open.");
      }
    } catch (permissionError) {
      console.error("Unable to request browser notification permission:", permissionError);
      showToast("Unable to enable browser notifications in this browser.");
    }
  }

  function logout() {
    setAdminToken(null);
    navigate("/admin");
  }


  // ============================================================
  // CATEGORY TOGGLE
  // ============================================================

  function toggleCategory(slug) {
    setForm((f) => ({
      ...f,

      categories: f.categories.includes(
        slug
      )
        ? f.categories.filter(
            (s) => s !== slug
          )
        : [...f.categories, slug],
    }));
  }


  // ============================================================
  // EDIT PRODUCT
  // ============================================================

  function editProduct(p) {
    navigate("/admin/products");
    setEditingId(p._id);
    setStockTotalDraft(null);
    setStockAdjustmentTarget(p.variantStock?.length
      ? `variant:${p.variantStock[0].color}::${p.variantStock[0].size}`
      : p.colors?.length
        ? `color:${p.colors[0].name}`
        : "");
    setCustomSizeName("");
    setCustomSizes((p.sizes || []).filter((size) =>
      !SIZE_OPTIONS.some((defaultSize) => defaultSize.toLowerCase() === String(size).toLowerCase())
    ));

    setForm({
      title: p.title,
      sku: p.sku,
      price: p.price,
      discount: p.discount || 0,
      stock: p.stock ?? 1,
      images: (p.images || []).join(
        ", "
      ),
      type: p.type,
      fabric: p.fabric,
      dupatta: p.dupatta,
      colorsText: "",
      sizesText: (p.sizes || []).join(
        ", "
      ),
      categories: p.categories || [],
      soldOut: p.soldOut,
      isNew: p.isNew,
      description: p.description,
      careGuide: p.careGuide,
      shipping: p.shipping,
      variantStockText: "",
    });

    setColorRows(
      (p.colors || []).map((color) => ({
        name: color.name,
        hex: color.hex,
        stock: color.stock ?? 1,
        images: (
          color.images || []
        ).join(", "),
      }))
    );

    setVariantRows(
      p.variantStock || []
    );

    setProductPreview(null);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  // ============================================================
  // DELETE PRODUCT
  // ============================================================

  async function deleteProduct(id) {
    if (
      !window.confirm(
        "Delete this product?"
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/products/${id}`
      );

      loadProducts();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete product"
      );
    }
  }


  // ============================================================
  // UPDATE ORDER
  // ============================================================

  async function updateOrder(order, field, value) {
    try {
      const response = await api.patch(`/admin/orders/${order._id}`, { [field]: value });
      setOrders((current) => current.map((item) => item._id === order._id ? response.data : item));
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update order");
    }
  }

  async function saveOrderAddress(order) {
    try {
      const response = await api.patch(`/admin/orders/${order._id}`, { shippingAddress: orderAddressDraft });
      setOrders((current) => current.map((item) => item._id === order._id ? response.data : item));
      setEditingOrderId("");
      setOrderAddressDraft(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update order information.");
    }
  }

  async function saveCustomer() {
    const phone = customerDraft.phone.trim();
    const email = customerDraft.email.trim();
    if (!hasValidCustomerPhone(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!hasValidCustomerEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      const response = await api.patch(`/admin/customers/${editingCustomerId}`, { ...customerDraft, phone, email });
      setCustomers((current) => current.map((customer) => customer._id === editingCustomerId ? response.data : customer));
      setOrders((current) => current.map((order) => order.customer?._id === editingCustomerId
        ? {
            ...order,
            customer: response.data,
            shippingAddress: { ...order.shippingAddress, name: response.data.name, phone: response.data.phone, email: response.data.email || "" },
            editedAt: new Date().toISOString(),
            editedBy: "admin",
          }
        : order));
      setEditingCustomerId("");
      setCustomerDraft({ name: "", phone: "", email: "" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update customer information.");
    }
  }

  async function createCustomer(event) {
    event.preventDefault();
    const name = newCustomerDraft.name.trim();
    const phone = newCustomerDraft.phone.trim();
    const email = newCustomerDraft.email.trim();
    if (!name || !hasValidCustomerPhone(phone) || !hasValidCustomerEmail(email)) {
      setError("Enter a customer name, valid 10-digit Indian mobile number, and valid email address.");
      return;
    }
    try {
      const response = await api.post("/admin/customers", { name, phone, email });
      setCustomers((current) => [response.data, ...current]);
      setNewCustomerDraft({ name: "", phone: "", email: "" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save customer details.");
    }
  }

  async function deleteCustomer(customer) {
    const confirmed = window.confirm(`Delete ${customer.name}'s customer information? Personal data in existing orders will be anonymized; order and payment records remain.`);
    if (!confirmed) return;
    try {
      await api.delete(`/admin/customers/${customer._id}`);
      setCustomers((current) => current.filter((item) => item._id !== customer._id));
      setOrders((current) => current.map((order) => order.customer?._id === customer._id
        ? { ...order, customer: null, shippingAddress: { name: "Deleted customer", phone: "Deleted", email: "", address: "Deleted", city: "Deleted", state: "Deleted", pinCode: "Deleted" }, review: null }
        : order));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete customer.");
    }
  }

  const orderPhases = [
    ["order_placed", "Order Placed"],
    ["payment_confirmed", "Payment Confirmed"],
    ["processing_packed", "Processing / Packed"],
    ["shipped", "Shipped"],
    ["out_for_delivery", "Out for Delivery"],
    ["delivered", "Delivered"],
    ["cancelled_refund", "Cancelled / Refund"],
  ];


  // ============================================================
  // CREATE MANUAL / OFFLINE ORDER
  // ============================================================

  async function createManualOrder(
    event
  ) {
    event.preventDefault();
    if (savingManualOrder) return;

    setSavingManualOrder(true);
    try {
      setError("");

      const response = await api.post(
        "/admin/orders",
        {
          customer: {
            customerId:
              manualOrder.customerId,
            address:
              manualOrder.address,
            city:
              manualOrder.city,
            state:
              manualOrder.state,
            pinCode:
              manualOrder.pinCode,
          },

          source:
            manualOrder.source,

          paymentMethod:
            manualOrder.paymentMethod,

          items: [
            {
              productId:
                manualOrder.productId ||
                undefined,

              title:
                manualOrder.title,

              price:
                manualOrder.price,

              quantity:
                manualOrder.quantity,
              color:
                manualOrder.color ||
                undefined,
              size:
                manualOrder.size ||
                undefined,
            },
          ],
        }
      );

      setOrders((current) => [
        response.data,
        ...current.filter((order) => order._id !== response.data._id),
      ]);
      setTableSearch((current) => ({ ...current, orders: "" }));
      setPages((current) => ({ ...current, orders: 1 }));
      setReportFilters((current) => ({
        ...current,
        orders: { period: "all", start: "", end: "" },
      }));
      setExpandedOrder(response.data._id);
      setManualOrder({
        customerId: "",
        address: "",
        city: "",
        state: "",
        pinCode: "",
        title: "",
        price: "",
        color: "",
        size: "",
        quantity: 1,
        paymentMethod: "whatsapp",
        source: "whatsapp",
        productId: "",
      });

      setProductSearch("");
      setError(response.data.warning || "");
      showToast(response.data.warning
        ? "Order saved. A follow-up step needs attention."
        : "Order saved successfully.");

      loadProducts();
      window.requestAnimationFrame(() => {
        document.getElementById("admin-orders-list")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });

    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create offline order"
      );
    } finally {
      setSavingManualOrder(false);
    }
  }


  // ============================================================
  // PAGINATION
  // ============================================================

  function paged(items, key) {
    const search =
      tableSearch[key]
        .trim()
        .toLowerCase();

    const filtered = items.filter(
      (item) =>
        JSON.stringify(item)
          .toLowerCase()
          .includes(search)
    );

    const pageCount = Math.max(
      1,
      Math.ceil(
        filtered.length / 20
      )
    );

    const page = Math.min(
      pages[key],
      pageCount
    );

    return {
      rows: filtered.slice(
        (page - 1) * 20,
        page * 20
      ),
      pageCount,
      page,
    };
  }


  // ============================================================
  // TABLE SEARCH
  // ============================================================

  function setTableSearchValue(
    key,
    value
  ) {
    setTableSearch((current) => ({
      ...current,
      [key]: value,
    }));

    setPages((current) => ({
      ...current,
      [key]: 1,
    }));
  }


  // ============================================================
  // WHATSAPP MESSAGE
  // ============================================================

  function getOrderMessage(order) {
    const orderId =
      order._id
        .slice(-8)
        .toUpperCase();

    const items = (
      order.items || []
    )
      .map(
        (item) =>
          `- ${item.title} x${item.quantity}` +
          `${
            item.size
              ? ` | Size: ${item.size}`
              : ""
          }` +
          `${
            item.color
              ? ` | Shade: ${item.color}`
              : ""
          }` +
          ` | Rs. ${Number(
            item.price
          ).toLocaleString(
            "en-IN"
          )}`
      )
      .join("\n");

    const address =
      order.shippingAddress ||
      {};

    return `Hello ${
      order.customer?.name ||
      address.name ||
      "Customer"
    },

Order update from Kashmir Cloth Stores
Order ID: #${orderId}
Status: ${order.status}
Payment: ${order.paymentMethod}

Order summary:
${items}

Total: Rs. ${Number(
      order.total
    ).toLocaleString("en-IN")}

Delivery address: ${
      address.address || ""
    }, ${
      address.city || ""
    }, ${
      address.state || ""
    } - ${
      address.pinCode || ""
    }

${
  order.trackingNumber
    ? `Tracking: ${
        order.carrier ||
        "Shipment"
      } ${
        order.trackingNumber
      }\n`
    : ""
}
Thank you for shopping with Kashmir Cloth Stores.`;
  }


  // ============================================================
  // OPEN WHATSAPP
  // ============================================================

  function openWhatsApp(order) {
    const phone = String(
      order.shippingAddress
        ?.phone ||
        order.customer?.phone ||
        ""
    ).replace(
      /[^0-9]/g,
      ""
    );

    if (!phone) {
      setError(
        "This order has no customer phone number"
      );

      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        getOrderMessage(order)
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

// ============================================================
// SEND EMAIL VIA GMAIL COMPOSE
// ============================================================

function sendStructuredEmail(order) {
  const email =
    order.shippingAddress?.email ||
    order.customer?.email;

  if (!email) {
    setError("This order has no customer email address");
    return;
  }

  const orderId = order._id
    .slice(-8)
    .toUpperCase();

  const subject =
    `Kashmir Cloth Stores order #${orderId} update`;

  const body = getOrderMessage(order);

  const gmailUrl =
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(
    gmailUrl,
    "_blank",
    "noopener,noreferrer"
  );
}
  // ============================================================
  // DELETE ORDER
  // ============================================================

  async function deleteOrder(order) {
    if (
      !window.confirm(
        `Delete order #${order._id
          .slice(-8)
          .toUpperCase()}? Stock will be restored for products and variants that are still available.`
      )
    ) {
      return;
    }

    setDeletingOrderId(order._id);
    try {
      const response = await api.delete(
        `/admin/orders/${order._id}`
      );

      setOrders((current) =>
        current.filter(
          (item) =>
            item._id !== order._id
        )
      );

      setExpandedOrder(null);
      setError("");
      showToast(response.data.warning || response.data.message || "Order deleted.");

    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete order"
      );
    } finally {
      setDeletingOrderId("");
    }
  }


  // ============================================================
  // RESET PRODUCT FORM
  // ============================================================

  function resetForm() {
    setEditingId(null);
    setStockTotalDraft(null);
    setStockAdjustmentTarget("");
    setForm(EMPTY);
    setColorRows([]);
    setVariantRows([]);
    setCustomSizeName("");
    setCustomSizes([]);
    setProductPreview(null);
  }

  function applyTotalStockChange() {
    if (stockTotalDraft === null) return;
    const nextTotal = Number(stockTotalDraft);
    if (!Number.isSafeInteger(nextTotal) || nextTotal < 0) {
      setError("Total stock must be a whole non-negative quantity.");
      setStockTotalDraft(null);
      return;
    }

    const difference = nextTotal - productStockTotal;
    if (!difference) {
      setStockTotalDraft(null);
      return;
    }

    if (variantRows.length) {
      const index = variantRows.findIndex((row) => `variant:${row.color}::${row.size}` === activeStockAdjustmentTarget);
      if (index < 0) {
        setError("Choose the color and size that should receive the stock adjustment.");
        setStockTotalDraft(null);
        return;
      }
      const currentStock = Math.max(0, Number(variantRows[index].stock) || 0);
      if (currentStock + difference < 0) {
        setError("The selected variant does not have enough quantity for this reduction. Choose another variant or reduce its quantity first.");
        setStockTotalDraft(null);
        return;
      }
      setVariantRows((rows) => rows.map((row, rowIndex) => rowIndex === index
        ? { ...row, stock: currentStock + difference }
        : row));
    } else if (colorRows.length) {
      const index = colorRows.findIndex((row) => `color:${row.name}` === activeStockAdjustmentTarget);
      if (index < 0) {
        setError("Choose the color that should receive the stock adjustment.");
        setStockTotalDraft(null);
        return;
      }
      const currentStock = Math.max(0, Number(colorRows[index].stock) || 0);
      if (currentStock + difference < 0) {
        setError("The selected color does not have enough quantity for this reduction. Choose another color or reduce its quantity first.");
        setStockTotalDraft(null);
        return;
      }
      setColorRows((rows) => rows.map((row, rowIndex) => rowIndex === index
        ? { ...row, stock: currentStock + difference }
        : row));
    } else {
      setForm((current) => ({ ...current, stock: nextTotal }));
    }

    setStockTotalDraft(null);
    setError("");
  }


  // ============================================================
  // UPDATE VARIANT ROW
  // ============================================================

  function updateVariantRow(
    index,
    field,
    value
  ) {
    setVariantRows((rows) => {
      const next = rows.map(
        (row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: value,
              }
            : row
      );

      const keys = next.map(
        (row) =>
          `${String(
            row.color
          )
            .trim()
            .toLowerCase()}::${String(
            row.size
          )
            .trim()
            .toLowerCase()}`
      );

      if (
        keys[index] !== "::" &&
        keys.filter(
          (key) =>
            key === keys[index]
        ).length > 1
      ) {
        setError(
          "That color and size combination already exists. Edit its quantity instead."
        );

        return rows;
      }

      setError("");

      return next;
    });
  }


  // ============================================================
  // ADD VARIANT ROW
  // ============================================================

  function addVariantRow() {
    const availableSizes = sizeOptions;
    const color = colorRows.find((entry) => !variantRows.some((variant) => variant.color === entry.name))
      || colorRows.find((entry) => availableSizes.some((size) => !variantRows.some((variant) => variant.color === entry.name && variant.size === size)));

    if (!color) {
      setError(
        "Add a color and an unused size before adding another size quantity."
      );

      return;
    }

    const size = availableSizes.find((entry) => !variantRows.some((variant) => variant.color === color.name && variant.size === entry));
    const hasColorVariants = variantRows.some((variant) => variant.color === color.name);

    setVariantRows((rows) => [
      ...rows,
      {
        size,
        color: color.name,
        stock: hasColorVariants ? 0 : Math.max(0, Number(color.stock) || 0),
      },
    ]);
    setError("");
  }

  function addCustomSize() {
    const size = customSizeName.trim();
    if (!size) {
      setError("Enter a name for the custom size.");
      return;
    }
    if (sizeOptions.some((existingSize) => existingSize.toLowerCase() === size.toLowerCase())) {
      setError("This size already exists.");
      return;
    }

    setForm((current) => ({
      ...current,
      sizesText: [...current.sizesText.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean), size].join(", "),
    }));
    setCustomSizes((sizes) => [...sizes, size]);
    setCustomSizeName("");
    setError("");
  }


  // ============================================================
  // PRODUCT SUBMIT
  // ============================================================

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    // Prevent duplicate color + size
    const variantKeys = new Set();

    for (const variant of variantRows) {
      const key =
        `${String(
          variant.color
        )
          .trim()
          .toLowerCase()}::${String(
          variant.size
        )
          .trim()
          .toLowerCase()}`;

      if (
        !variant.color ||
        !variant.size ||
        !colorRows.some((color) => color.name === variant.color) ||
        !Number.isInteger(Number(variant.stock)) ||
        Number(variant.stock) < 0 ||
        variantKeys.has(key)
      ) {
        setError(
          "Choose an existing color and size once, and enter a whole non-negative quantity for each."
        );

        return;
      }

      variantKeys.add(key);
    }


    // Prevent duplicate colors
    const colorKeys = new Set();

    for (const color of colorRows) {
      const key =
        String(color.name)
          .trim()
          .toLowerCase();

      if (
        !key ||
        colorKeys.has(key)
      ) {
        setError(
          "Each color can be added only once."
        );

        return;
      }

      colorKeys.add(key);
    }

    if (!variantRows.length && !colorRows.length && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0)) {
      setError("Product stock must be a whole non-negative quantity.");
      return;
    }
    if (!variantRows.length && colorRows.some((color) => !Number.isInteger(Number(color.stock)) || Number(color.stock) < 0)) {
      setError("Color stock must be a whole non-negative quantity.");
      return;
    }


    const payload = {
      title: form.title,

      sku: form.sku,

      price:
        Number(form.price),

      discount:
        Number(form.discount) || 0,

      stock: productStockTotal,
      soldOut: productStockTotal <= 0,

      images:
        form.images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),

      type:
        form.type,

      fabric:
        form.fabric,

      dupatta:
        form.dupatta,

      colors:
        colorRows.map(
          (color) => ({
            ...color,

            stock: colorStockTotal(color),

            images:
              color.images
                .split(",")
                .map(
                  (image) =>
                    image.trim()
                )
                .filter(Boolean),
          })
        ),

      variantStock:
        variantRows
          .filter(
            (variant) =>
              variant.size &&
              variant.color
          )
          .map(
            (variant) => ({
              ...variant,

              stock:
                Math.max(
                  0,
                  Number(
                    variant.stock
                  ) || 0
                ),
            })
          ),

      sizes:
        variantRows.length
          ? [
              ...new Set(
                [...variantRows.map(
                  (variant) =>
                    variant.size
                ), ...customSizes]
              ),
            ]
          : form.sizesText
              .split(",")
              .map(
                (s) =>
                  s.trim()
              )
              .filter(Boolean),

      categories:
        form.categories,

      isNew:
        form.isNew,

      description:
        form.description,

      careGuide:
        form.careGuide,

      shipping:
        form.shipping,
    };


    setProductPreview(payload);
  }

  async function confirmProductSave() {
    if (!productPreview || savingProduct) return;
    setSavingProduct(true);
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, productPreview);
      } else {
        await api.post("/products", productPreview);
      }
      resetForm();
      loadProducts();
      navigate("/admin/products");
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSavingProduct(false);
    }
  }

  const printableItems = printOrder?.items || [];
  const printableSubtotal = printableItems.reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const printableTotal = Number(printOrder?.total || 0);
  const printableAdjustment = printableTotal - printableSubtotal;
  const printableAddress = printOrder?.shippingAddress || {};
  const printableStatus = orderPhases.find(
    ([status]) => status === normalizedOrderStatus(printOrder?.status)
  )?.[1] || normalizedOrderStatus(printOrder?.status).replace(/_/g, " ");
  const printablePaymentStatus = printOrder?.paymentId
    ? "Paid — payment reference recorded"
    : printOrder?.paymentMethod === "cod"
      ? "Cash on delivery — collection status not recorded"
      : "Not recorded";

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="admin-dashboard" data-admin-page={adminPage}>

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="admin-head">
        <h2>Admin Panel — {adminPage[0].toUpperCase() + adminPage.slice(1)}</h2>

        <div className="admin-head-actions">
          <button className={`admin-section-tab${adminPage === "overview" ? " is-active" : ""}`} type="button" onClick={() => navigate("/admin/dashboard")}>Overview</button>
          <button className={`admin-section-tab${adminPage === "products" ? " is-active" : ""}`} type="button" onClick={() => navigate("/admin/products")}>Products</button>
          <button className={`admin-section-tab${adminPage === "add-product" ? " is-active" : ""}`} type="button" onClick={() => { resetForm(); navigate("/admin/add-product"); }}>Add Product</button>
          <button className={`admin-section-tab${adminPage === "sales" ? " is-active" : ""}`} type="button" onClick={() => navigate("/admin/sales")}>Sales</button>
          <button className={`admin-section-tab${adminPage === "orders" ? " is-active" : ""}`} type="button" onClick={() => navigate("/admin/orders")}>Orders</button>
          <button className={`admin-section-tab${adminPage === "customers" ? " is-active" : ""}`} type="button" onClick={() => navigate("/admin/customers")}>Customers</button>
          <button
            type="button"
            onClick={() => navigate("/admin/homepage-content")}
          >
            Homepage media
          </button>
          <button type="button" onClick={() => navigate("/admin/settings/categories")}>
            Storefront settings
          </button>
          <button onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {adminPage === "overview" && (
        <section className="admin-overview" aria-labelledby="admin-overview-title">
          <div className="admin-overview-welcome">
            <div>
              <p className="eyebrow">Store operations</p>
              <h1 id="admin-overview-title">Your store at a glance</h1>
              <p>Key sales, fulfilment, and stock signals to help you prioritize today.</p>
            </div>
            <div className="admin-overview-quick-actions">
              <button type="button" onClick={() => navigate("/admin/add-product")}>Add product</button>
              <button type="button" onClick={() => navigate("/admin/orders")}>Manage orders</button>
            </div>
          </div>

          <div className="admin-overview-metrics">
            <article className="admin-overview-metric">
              <span>Paid / active order value this month</span>
              <strong>Rs. {monthlyOrderValue.toLocaleString("en-IN")}</strong>
              <small>{monthlyOrders.length} confirmed order{monthlyOrders.length === 1 ? "" : "s"} this month</small>
            </article>
            <article className="admin-overview-metric">
              <span>Orders in progress</span>
              <strong>{activeOrders.length}</strong>
              <small>Excludes delivered and cancelled orders</small>
            </article>
            <article className={`admin-overview-metric${lowStockProducts.length ? " is-warning" : ""}`}>
              <span>Low-stock products</span>
              <strong>{inventory.filter((product) => product.inventoryStock <= 5).length}</strong>
              <small>Five or fewer units remaining, including sold out</small>
            </article>
            <article className="admin-overview-metric">
              <span>Customers</span>
              <strong>{customers.length}</strong>
              <small>Registered customer accounts</small>
            </article>
          </div>

          <div className="admin-overview-panels">
            <section className="admin-overview-panel">
              <div className="admin-overview-panel-head">
                <div>
                  <h2>Orders to follow up</h2>
                  <p>Oldest active orders first</p>
                </div>
                <button type="button" onClick={() => navigate("/admin/orders")}>All orders</button>
              </div>
              {attentionOrders.length ? (
                <div className="admin-overview-list">
                  {attentionOrders.map((order) => {
                    const status = normalizedOrderStatus(order.status);
                    return (
                      <article className="admin-overview-row" key={order._id}>
                        <div>
                          <strong>#{String(order._id).slice(-8).toUpperCase()}</strong>
                          <span>{order.shippingAddress?.name || order.customer?.name || "Customer"}</span>
                        </div>
                        <div className="admin-overview-row-end">
                          <span className={`admin-overview-status status-${status}`}>{statusLabels[status] || status}</span>
                          <small>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : "Date unavailable"}</small>
                        </div>
                        <button type="button" className="admin-overview-row-action" onClick={() => {
                          navigate(`/admin/orders?order=${encodeURIComponent(order._id)}`);
                        }}>Review order</button>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="admin-overview-empty">No orders currently need follow-up.</p>}
            </section>

            <section className="admin-overview-panel">
              <div className="admin-overview-panel-head">
                <div>
                  <h2>Stock running low</h2>
                  <p>Products with five or fewer units available</p>
                </div>
                <button type="button" onClick={() => navigate("/admin/products")}>Inventory</button>
              </div>
              {lowStockProducts.length ? (
                <div className="admin-overview-list">
                  {lowStockProducts.map((product) => (
                    <article className="admin-overview-row" key={product._id}>
                      <div>
                        <strong>{product.title}</strong>
                        <span>SKU: {product.sku}</span>
                      </div>
                      <span className={`admin-overview-stock${product.inventoryStock === 0 ? " is-out" : ""}`}>
                        {product.inventoryStock === 0 ? "Out of stock" : `${product.inventoryStock} left`}
                      </span>
                      <button type="button" className="admin-overview-row-action" onClick={() => editProduct(product)}>Update stock</button>
                    </article>
                  ))}
                </div>
              ) : <p className="admin-overview-empty">No low-stock products right now.</p>}
            </section>
          </div>

          <section className="admin-overview-panel admin-overview-best-sellers">
            <div className="admin-overview-panel-head">
              <div>
                <h2>Best sellers</h2>
                <p>Units on confirmed, active, or delivered orders</p>
              </div>
              <button type="button" onClick={() => navigate("/admin/sales")}>Sales report</button>
            </div>
            {bestSellingProducts.length ? (
              <ol className="admin-best-seller-list">
                {bestSellingProducts.map((product, index) => {
                  const largestQuantity = bestSellingProducts[0].quantity || 1;
                  return (
                    <li key={`${product.title}-${index}`}>
                      <span className="admin-best-seller-rank">{index + 1}</span>
                      <div className="admin-best-seller-info">
                        <div><strong>{product.title}</strong><span>{product.quantity} unit{product.quantity === 1 ? "" : "s"} ordered</span></div>
                        <span className="admin-best-seller-track"><i style={{ width: `${Math.max(4, (product.quantity / largestQuantity) * 100)}%` }} /></span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="admin-overview-empty">Sales insights will appear after a paid order is recorded.</p>}
          </section>
        </section>
      )}

      {/* ======================================================
          PRODUCT FORM
      ======================================================= */}

      <div className="admin-page-area admin-products-area">
      <section className="admin-inventory-overview">
        <div className="inventory-summary-cards">
          <article className="sales-summary-card">
            <span>Total sell</span>
            <strong>Rs. {totalSales.toLocaleString("en-IN")}</strong>
            <small>Paid, processing, shipped and delivered orders</small>
            <button type="button" className="sales-history-toggle" aria-expanded={showSalesHistory} onClick={() => setShowSalesHistory((open) => !open)}>
              {showSalesHistory ? "Hide sales history" : "View sales history"}
            </button>
          </article>
          <article className="inventory-summary-card"><span>Products in stock</span><strong>{inventory.filter((product) => product.inventoryStock > 0).length}</strong><small>{totalUnitsInStock} total units available</small></article>
          <article className="inventory-summary-card"><span>Out of stock</span><strong>{outOfStockCount}</strong><small>Products with no available units</small></article>
        </div>

        {(showSalesHistory || adminPage === "sales") && (
          <section className="sales-history-panel">
            <div className="sales-history-controls">
              <label>Sales period
                <select value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value)}>
                  <option value="today">Today</option>
                  <option value="this_week">This week</option>
                  <option value="this_month">This month</option>
                  <option value="this_year">This year</option>
                  <option value="last_year">Last year</option>
                  <option value="custom">Custom dates</option>
                </select>
              </label>
              {salesPeriod === "custom" && <>
                <label>From<input type="date" value={salesStart} onChange={(event) => setSalesStart(event.target.value)} /></label>
                <label>To<input type="date" value={salesEnd} onChange={(event) => setSalesEnd(event.target.value)} /></label>
              </>}
            </div>
            <div className="sales-history-total">
              <span>Sales in selected period</span>
              <strong>Rs. {salesHistoryTotal.toLocaleString("en-IN")}</strong>
              <small>{salesHistoryOrders.filter((order) => confirmedStatuses.has(order.status)).length} paid / active orders</small>
            </div>
          </section>
        )}

        <div className="inventory-dashboard-section">
        <div className="inventory-section-head">
          <div>
            <h3>Inventory by category</h3>
            <p>Stock totals use size/color variants when configured, otherwise product or color stock.</p>
          </div>
          <label>
            Category
            <select value={inventoryCategory} onChange={(event) => setInventoryCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {storefrontCategories.find((entry) => entry.productTag === category || entry.tag === category || entry.slug === category)?.label || (category === "uncategorized" ? "Uncategorized" : category)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Units</th><th>Availability</th><th>Action</th></tr></thead>
            <tbody>
              {visibleInventory.map((product) => (
                <tr key={product._id}>
                  <td>{product.title}</td>
                  <td>{product.sku}</td>
                  <td>{product.inventoryCategories.map((category) => CATEGORIES.find((entry) => entry.tag === category || entry.slug === category)?.label || category).join(", ")}</td>
                  <td>{product.inventoryStock}</td>
                  <td><span className={`inventory-status${product.inventoryStock <= 0 ? " is-out" : ""}`}>{product.inventoryStock > 0 ? "In stock" : "Out of stock"}</span></td>
                  <td><button type="button" onClick={() => editProduct(product)}>Edit stock</button></td>
                </tr>
              ))}
              {!visibleInventory.length && <tr><td colSpan="6">No products in this category.</td></tr>}
            </tbody>
          </table>
        </div>
        </div>
      </section>

      <form
        className={`admin-form${editingId ? " is-editing" : ""}`}
        onSubmit={handleSubmit}
      >
        <h3>
          {editingId
            ? "Edit Product"
            : "Add New Product"}
        </h3>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        <div className="admin-grid">

          <label>
            Title

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title:
                    e.target.value,
                })
              }
              required
            />
          </label>


          <label>
            SKU / Code

            <input
              value={form.sku}
              onChange={(e) =>
                setForm({
                  ...form,
                  sku:
                    e.target.value,
                })
              }
              required
            />
          </label>


          <label>
            Price (Rs.)

            <input
              type="number"
              value={form.price}
              onChange={(e) =>
                setForm({
                  ...form,
                  price:
                    e.target.value,
                })
              }
              required
            />
          </label>


          <label>
            {variantRows.length || colorRows.length ? "Total quantity (from color/size stock)" : "Product stock"}

            <input
              type="number"
              min="0"
              step="1"
              value={stockTotalDraft ?? productStockTotal}
              onFocus={() => setStockTotalDraft(String(productStockTotal))}
              onChange={(event) => setStockTotalDraft(event.target.value)}
              onBlur={applyTotalStockChange}
              required
            />
          </label>

          {(variantRows.length > 0 || colorRows.length > 0) && (
            <label className="span-2">
              Apply total quantity change to
              <select
                value={activeStockAdjustmentTarget}
                onChange={(event) => setStockAdjustmentTarget(event.target.value)}
              >
                {stockAdjustmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <small>The total change is applied to this color/size. A reduction cannot make its stock negative.</small>
            </label>
          )}


          <label>
            Discount (%)

            <input
              type="number"
              min="0"
              max="99"
              value={form.discount}
              onChange={(e) =>
                setForm({
                  ...form,
                  discount:
                    e.target.value,
                })
              }
            />
          </label>


          <label>
            Type

            <input
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type:
                    e.target.value,
                })
              }
            />
          </label>


          <label>
            Fabric

            <input
              value={form.fabric}
              onChange={(e) =>
                setForm({
                  ...form,
                  fabric:
                    e.target.value,
                })
              }
            />
          </label>


          <label>
            Dupatta

            <input
              value={form.dupatta}
              onChange={(e) =>
                setForm({
                  ...form,
                  dupatta:
                    e.target.value,
                })
              }
            />
          </label>


          <label className="span-2">
            Image URLs
            (comma separated)

            <input
              value={form.images}
              onChange={(e) =>
                setForm({
                  ...form,
                  images:
                    e.target.value,
                })
              }
              placeholder="https://... , https://..."
            />
          </label>


          {/* COLORS */}

          <div className="span-2 product-inventory-field">
            <h4>Colors and shade photos</h4>

            <div className="palette-picker">

              {COLOR_PALETTE.map(
                ([name, hex]) => (
                  <button
                    type="button"
                    key={name}
                    title={`Add ${name}`}
                    className="palette-swatch"
                    style={{
                      background:
                        hex,
                    }}
                    onClick={() =>
                      setColorRows(
                        (rows) =>
                          rows.some(
                            (row) =>
                              row.name ===
                              name
                          )
                            ? rows
                            : [
                                ...rows,
                                {
                                  name,
                                  hex,
                                          stock: 0,
                                  images:
                                    "",
                                },
                              ]
                      )
                    }
                  />
                )
              )}

            </div>
            <div className="custom-color-controls">
              <label>
                Custom color name
                <input
                  value={customColorName}
                  maxLength={40}
                  onChange={(event) => setCustomColorName(event.target.value)}
                  placeholder="e.g. Teal"
                />
              </label>
              <label>
                Color shade
                <input type="color" value={customColorHex} onChange={(event) => setCustomColorHex(event.target.value)} aria-label="Custom color shade" />
              </label>
              <button type="button" onClick={() => {
                const name = customColorName.trim();
                if (!name) {
                  setError("Enter a name for the custom color.");
                  return;
                }
                if (COLOR_PALETTE.some(([paletteName]) => paletteName.toLowerCase() === name.toLowerCase())
                  || colorRows.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
                  setError("Each color can be added only once.");
                  return;
                }
                setColorRows((rows) => [...rows, { name, hex: customColorHex, stock: 0, images: "" }]);
                setCustomColorName("");
                setError("");
              }}>Add custom color</button>
            </div>

            <div className="color-row-labels" aria-hidden="true"><span>Color</span><span>Shade</span><span>Total pieces</span><span>Shade photo URLs</span><span /></div>
            <div className="variant-editor">

              {colorRows.map(
                (
                  color,
                  index
                ) => (

                  <div
                        className="variant-editor-row color-inventory-row"
                    key={`${color.name}-${index}`}
                  >

                    <select
                      value={
                        color.name
                      }
                      onChange={(e) => {
                        const [
                          name,
                          hex,
                        ] =
                          COLOR_PALETTE.find(
                            (item) =>
                              item[0] ===
                              e.target
                                .value
                          ) ||
                          [
                            e.target.value,
                            color.hex,
                          ];

                        if (colorRows.some((row, i) => i !== index && row.name.toLowerCase() === name.toLowerCase())) {
                          setError("Each color can be added only once.");
                          return;
                        }
                        setColorRows((rows) => rows.map((row, i) => i === index ? { ...row, name, hex } : row));
                        setVariantRows((rows) => rows.map((row) => row.color === color.name ? { ...row, color: name } : row));
                        setError("");
                      }}
                    >
                      {Array.from(new Set([...COLOR_PALETTE.map(([name]) => name), color.name])).map(
                        (name) => (
                          <option
                            key={name}
                          >
                            {name}
                          </option>
                        )
                      )}
                    </select>


                    <input
                      type="color"
                      value={
                        color.hex
                      }
                      aria-label={`${color.name} color`}
                      onChange={(e) =>
                        setColorRows(
                          (rows) =>
                            rows.map(
                              (
                                row,
                                i
                              ) =>
                                i === index
                                  ? {
                                      ...row,
                                      hex:
                                        e.target
                                          .value,
                                    }
                                  : row
                            )
                        )
                      }
                    />


                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={colorStockTotal(color)}
                      disabled={variantRows.length > 0}
                      aria-label={`${color.name} total quantity`}
                      placeholder="Color total"
                      onChange={(e) =>
                        setColorRows(
                          (rows) =>
                            rows.map(
                              (
                                row,
                                i
                              ) =>
                                i === index
                                  ? {
                                      ...row,
                                      stock:
                                        e.target
                                          .value,
                                    }
                                  : row
                            )
                        )
                      }
                    />


                    <input
                      value={
                        color.images
                      }
                      placeholder="Shade photo URL(s), comma separated"
                      onChange={(e) =>
                        setColorRows(
                          (rows) =>
                            rows.map(
                              (
                                row,
                                i
                              ) =>
                                i === index
                                  ? {
                                      ...row,
                                      images:
                                        e.target
                                          .value,
                                    }
                                  : row
                            )
                        )
                      }
                    />


                    <button
                      type="button"
                      onClick={() => {
                        setColorRows((rows) => rows.filter((_, i) => i !== index));
                        setVariantRows((rows) => rows.filter((row) => row.color !== color.name));
                      }}
                    >
                      Remove
                    </button>

                  </div>

                )
              )}

            </div>

          </div>


          {/* VARIANTS */}

          <div className="span-2 product-inventory-field">
            <h4>Size-wise quantity by color</h4>
            <p className="product-inventory-help">Each row shows its size, selected color, and piece count. A color keeps its current quantity until you add size rows for that color.</p>

            <div className="variant-editor">

              {variantRows.map(
                (
                  variant,
                  index
                ) => (

                  <div
                    className="variant-editor-row size-inventory-row"
                    key={`${variant.size}-${variant.color}-${index}`}
                  >

                    <label className="variant-editor-control">
                      <span>Size</span>
                      <select
                        aria-label={`Size for ${variant.color || "selected color"}`}
                        value={variant.size}
                        onChange={(e) => updateVariantRow(index, "size", e.target.value)}
                      >
                        {sizeOptions.map((size) => <option key={size}>{size}</option>)}
                      </select>
                    </label>

                    <label className="variant-editor-control">
                      <span>Color</span>
                      <select
                        aria-label={`Color for size ${variant.size}`}
                        value={variant.color}
                        onChange={(e) => updateVariantRow(index, "color", e.target.value)}
                      >
                        <option value="">Choose color</option>
                        {colorRows.map((color) => <option key={color.name} value={color.name}>{color.name}</option>)}
                      </select>
                    </label>

                    <label className="variant-editor-control">
                      <span>Quantity (pieces)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={variant.stock}
                        aria-label={`${variant.color} ${variant.size} quantity`}
                        onChange={(e) => updateVariantRow(index, "stock", e.target.value)}
                      />
                    </label>


                    <button
                      type="button"
                      onClick={() =>
                        setVariantRows(
                          (rows) =>
                            rows.filter(
                              (_, i) =>
                                i !==
                                index
                            )
                        )
                      }
                    >
                      Remove
                    </button>

                  </div>

                )
              )}


              <button
                type="button"
                className="add-variant-button"
                onClick={
                  addVariantRow
                }
              >
                + Add size and color
                quantity
              </button>
              <div className="custom-size-controls">
                <label>
                  Custom size name
                  <input
                    value={customSizeName}
                    maxLength={40}
                    onChange={(event) => setCustomSizeName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomSize();
                      }
                    }}
                    placeholder="e.g. 4XL or 38"
                  />
                </label>
                <button type="button" onClick={addCustomSize}>Add custom size</button>
              </div>

            </div>
            <div className="product-stock-preview">
              <strong>Current stock preview: {productStockTotal} total pieces</strong>
              {colorRows.length ? colorRows.map((color) => {
                const variants = variantRows.filter((variant) => variant.color === color.name);
                return <p key={color.name}><span>{color.name}: {colorStockTotal(color)} pieces</span><small>{variants.length ? variants.map((variant) => `${variant.size} × ${Math.max(0, Number(variant.stock) || 0)}`).join(" · ") : variantRows.length ? "No size quantities assigned" : "Sizes not specified"}</small></p>;
              }) : <p>Add colors to see the stock breakdown by color and size.</p>}
            </div>

          </div>


          <label className="span-2">
            Description

            <textarea
              value={
                form.description
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  description:
                    e.target.value,
                })
              }
            />
          </label>


          <label className="span-2">
            Care Guide

            <textarea
              value={
                form.careGuide
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  careGuide:
                    e.target.value,
                })
              }
            />
          </label>


          <div className="span-2 checkbox-row">

            <label>
              <input
                type="checkbox"
                checked={productStockTotal <= 0}
                readOnly
                disabled
              />

              Sold Out (automatic when stock is zero)
            </label>


            <label>
              <input
                type="checkbox"
                checked={
                  form.isNew
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    isNew:
                      e.target.checked,
                  })
                }
              />

              Mark as New
            </label>

          </div>


          {/* CATEGORIES */}

          <div className="span-2">

            <h4>
              Categories
              (a product can be in
              more than one)
            </h4>

            <div className="category-checkboxes">

              {tagCategories.map(
                (c) => (
                  <label
                    key={c.slug}
                  >
                    <input
                      type="checkbox"
                      checked={form.categories.includes(
                        c.tag
                      )}
                      onChange={() =>
                        toggleCategory(
                          c.tag
                        )
                      }
                    />

                    {c.label}
                  </label>
                )
              )}

            </div>

          </div>

        </div>


        <div className="admin-form-actions">

          <button type="submit">
            {editingId
              ? "Save Changes"
              : "Add Product"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}

        </div>

      </form>

      {productPreview && (
        <div className="product-preview-backdrop" role="presentation">
          <section className="product-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="product-preview-title">
            <h3 id="product-preview-title">Review product stock before saving</h3>
            <p><strong>{productPreview.title}</strong> · SKU {productPreview.sku}</p>
            <p className="product-preview-total">Total quantity: <strong>{productPreview.stock} pieces</strong></p>
            {productPreview.colors.length ? (
              <div className="product-preview-colors">
                {productPreview.colors.map((color) => {
                  const variants = productPreview.variantStock.filter((variant) => variant.color === color.name);
                  return (
                    <article key={color.name}>
                      <strong>{color.name}: {color.stock} pieces</strong>
                      <span>{variants.length ? variants.map((variant) => `${variant.size}: ${variant.stock}`).join(" · ") : "No size quantities assigned"}</span>
                    </article>
                  );
                })}
              </div>
            ) : <p>No colors configured. General product stock: {productPreview.stock} pieces.</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="product-preview-actions">
              <button type="button" disabled={savingProduct} onClick={() => setProductPreview(null)}>Go back and edit</button>
              <button type="button" disabled={savingProduct} onClick={confirmProductSave}>{savingProduct ? "Saving…" : editingId ? "Confirm changes" : "Confirm and add product"}</button>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================
          PRODUCTS
      ======================================================= */}

      <section className="admin-products-list">
      <h3>
        All Products ({
          products.length
        })
      </h3>

      <input
        className="admin-search"
        placeholder="Search products by title or SKU"
        value={
          tableSearch.products
        }
        onChange={(event) =>
          setTableSearchValue(
            "products",
            event.target.value
          )
        }
      />


      <table className="admin-table">

        <thead>
          <tr>
            <th>Image</th>
            <th>Title</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Categories</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>


        <tbody>

          {paged(
            products,
            "products"
          ).rows.map((p) => (

            <tr
              key={p._id}
            >

              <td>
                <img
                  className="admin-thumb"
                  src={
                    p.images?.[0]
                  }
                  alt=""
                />
              </td>

              <td>
                {p.title}
              </td>

              <td>
                {p.sku}
              </td>

              <td>
                Rs. {p.price}
              </td>

              <td>
                {(
                  p.categories ||
                  []
                ).join(", ")}
              </td>

              <td>
                {p.soldOut
                  ? "Sold Out"
                  : "In Stock"}
              </td>

              <td>

                <button
                  onClick={() =>
                    editProduct(p)
                  }
                >
                  Edit
                </button>

                <button
                  onClick={() =>
                    deleteProduct(
                      p._id
                    )
                  }
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>


      <Pagination
        {...paged(
          products,
          "products"
        )}
        onChange={(value) =>
          setPages(
            (current) => ({
              ...current,
              products:
                value,
            })
          )
        }
      />
      </section>
      </div>


      {/* ======================================================
          MANUAL ORDER
      ======================================================= */}

      <div className="admin-page-area admin-orders-area">
      <section className="admin-section">

        <h3>
          Add WhatsApp / Instagram
          order
        </h3>

        {error && <p className="error" role="alert">{error}</p>}

        <form
          className="admin-form manual-order-form"
          aria-busy={savingManualOrder}
          onSubmit={
            createManualOrder
          }
        >

          <div className="admin-grid">

            <label className="span-2">
              Select saved customer
              <select
                required
                value={manualOrder.customerId}
                onChange={(event) => setManualOrder((current) => ({
                  ...current,
                  customerId: event.target.value,
                  address: "",
                  city: "",
                  state: "",
                  pinCode: "",
                }))}
              >
                <option value="">Choose a customer already saved in Customers</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} · {customer.phone} · {customerDisplayId(customer)}
                  </option>
                ))}
              </select>
            </label>

            {!customers.length && (
              <p className="span-2">
                Save customer information in Customers before creating an offline order.
                <button type="button" onClick={() => navigate("/admin/customers")}>Add customer first</button>
              </p>
            )}

            {manualCustomer && (
              <p className="span-2">
                {customerDisplayId(manualCustomer)} · {manualCustomer.phone} · {manualCustomer.email}
              </p>
            )}

            {[
              ["address", "Delivery address"],
              ["city", "City"],
              ["state", "State"],
              ["pinCode", "PIN code"],
            ].map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  required
                  value={manualOrder[field]}
                  onChange={(event) => setManualOrder((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))}
                />
              </label>
            ))}


            <label className="span-2">

              Search product

              <input
                value={
                  productSearch
                }
                placeholder="Type product name or SKU"
                onChange={(event) =>
                  setProductSearch(
                    event.target.value
                  )
                }
              />

            </label>


            <label>

              Product

              <select
                required
                value={
                  manualOrder.productId ||
                  ""
                }
                onChange={(event) => {
                  const product =
                    products.find(
                      (item) =>
                        item._id ===
                        event.target.value
                    );

                  setManualOrder({
                    ...manualOrder,
                    productId:
                      product?._id || "",
                    title:
                      product?.title || "",
                    price:
                      product
                        ? product.salePrice ??
                          product.price
                        : "",
                    color: "",
                    size: "",
                    quantity: 1,
                  });
                }}
              >
                <option value="">
                  Select product
                </option>

                {products
                  .filter(
                    (product) =>
                      `${product.title} ${product.sku}`
                        .toLowerCase()
                        .includes(
                          productSearch.toLowerCase()
                        )
                  )
                  .slice(0, 20)
                  .map((product) => (
                    <option
                      key={product._id}
                      value={product._id}
                    >
                      {product.title} (SKU{" "}
                      {product.sku})
                    </option>
                  ))}
              </select>

            </label>


            <label>

              Color

              <select
                required={manualHasColors}
                disabled={!manualOrder.productId || (manualHasColors && manualColorOptions.length === 0)}
                value={manualOrder.color || ""}
                onChange={(event) =>
                  setManualOrder({
                    ...manualOrder,
                    color: event.target.value,
                    size: "",
                    quantity: 1,
                  })
                }
              >
                <option value="">
                  {!manualOrder.productId
                    ? "Select product first"
                    : manualHasColors
                      ? "Select color"
                      : "No color required"}
                </option>
                {manualColorOptions.map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>

            </label>


            <label>

              Size

              <select
                required={manualSizeOptions.length > 0}
                disabled={
                  !manualOrder.productId ||
                  (manualHasColors && !manualOrder.color) ||
                  manualSizeOptions.length === 0
                }
                value={manualOrder.size || ""}
                onChange={(event) => {
                  setManualOrder({
                    ...manualOrder,
                    size: event.target.value,
                    quantity: Math.min(
                      Number(
                        manualOrder.quantity
                      ) || 1,
                      manualOrderStock(manualProduct, manualOrder.color, event.target.value) || 1
                    ),
                  });
                }}
              >
                <option value="">
                  {!manualOrder.productId
                    ? "Select product first"
                    : manualHasColors && !manualOrder.color
                    ? "Select color first"
                    : "Select size"}
                </option>
                {manualSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} — {manualOrderStock(manualProduct, manualOrder.color, size)} available
                  </option>
                ))}
              </select>

            </label>


            <label>

              Quantity

              <input
                required
                type="number"
                min="1"
                max={manualMaxStock || undefined}
                disabled={
                  !manualOrder.productId ||
                  (manualHasColors && !manualOrder.color) ||
                  !manualOrder.size ||
                  manualMaxStock <= 0
                }
                value={manualOrder.quantity}
                onChange={(event) => {
                  const maxStock = manualMaxStock || 1;

                  const value = Math.max(
                    1,
                    Math.min(
                      maxStock,
                      Number(
                        event.target.value
                      ) || 1
                    )
                  );

                  setManualOrder({
                    ...manualOrder,
                    quantity: value,
                  });
                }}
              />

            </label>


            <label>

              Order source

              <select
                value={
                  manualOrder.source
                }
                onChange={(event) =>
                  setManualOrder({
                    ...manualOrder,
                    source:
                      event.target
                        .value,
                  })
                }
              >

                <option value="whatsapp">
                  WhatsApp
                </option>

                <option value="instagram">
                  Instagram
                </option>

                <option value="admin">
                  Other / admin
                </option>

              </select>

            </label>


            <label>

              Payment received

              <select
                value={
                  manualOrder.paymentMethod
                }
                onChange={(event) =>
                  setManualOrder({
                    ...manualOrder,
                    paymentMethod:
                      event.target
                        .value,
                  })
                }
              >

                <option value="whatsapp">
                  WhatsApp payment
                </option>

                <option value="instagram">
                  Instagram payment
                </option>

                <option value="phonepe-manual">
                  PhonePe
                </option>

                <option value="razorpay-manual">
                  Razorpay
                </option>

                <option value="cod">
                  Cash on delivery
                </option>

              </select>

            </label>

          </div>


          <button type="submit" disabled={savingManualOrder}>
            {savingManualOrder ? "Saving order..." : "Save offline order"}
          </button>

        </form>

      </section>


      {/* ======================================================
          ORDERS
      ======================================================= */}

      <section className="admin-section" id="admin-orders-list">

        <div className="admin-orders-heading">
          <h3>Orders ({orders.length})</h3>
          <div className="admin-order-notification-control">
            {notificationPermission === "default" && (
              <button type="button" onClick={enableBrowserNotifications}>
                <Bell size={15} />
                Enable browser notifications
              </button>
            )}
            {notificationPermission === "granted" && (
              <span className="admin-notification-enabled">
                <Bell size={15} />
                Browser notifications enabled
              </span>
            )}
            {notificationPermission === "denied" && (
              <span className="admin-notification-help">
                Browser notifications are blocked; in-dashboard alerts remain active.
              </span>
            )}
            {notificationPermission === "unsupported" && (
              <span className="admin-notification-help">
                Browser notifications unavailable; in-dashboard alerts remain active.
              </span>
            )}
            <small>New orders are checked every 30 seconds while this dashboard is open.</small>
          </div>
        </div>

        <section className="payment-feedback-admin">
          <h4>Checkout feedback ({paymentFeedback.length})</h4>
          {paymentFeedback.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Customer</th><th>Outcome</th><th>Reason</th><th>Order</th><th>Item(s)</th><th>Details</th></tr></thead>
                <tbody>
                  {paymentFeedback.map((entry) => (
                    <tr key={entry._id}>
                      <td>{new Date(entry.createdAt).toLocaleString("en-IN")}</td>
                      <td>{entry.customer?.name || "Customer"}{entry.customer?.phone && <small>{entry.customer.phone}</small>}</td>
                      <td>{entry.outcome === "failed" ? "Payment failed" : "Exited checkout"}</td>
                      <td>{({
                        payment_method: "Payment method unavailable",
                        technical_issue: "Technical issue",
                        changed_mind: "Changed mind",
                        need_help: "Needs help",
                        other: "Other",
                      })[entry.reason] || entry.reason}</td>
                      <td>{entry.orderId}</td>
                      <td>{(entry.items || []).map((item) => `${item.title} × ${item.quantity}`).join(", ")}</td>
                      <td>{entry.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No checkout feedback has been submitted yet.</p>}
        </section>

        <ReportDateFilter
          label="Orders date range"
          value={reportFilters.orders}
          onChange={(value) => setReportFilters((current) => ({ ...current, orders: value }))}
        />
        <div className="admin-export-actions" aria-label="Download orders">
          <button type="button" onClick={() => exportReport("pdf", "Orders report", ["Order", "Customer", "Phone", "Items", "Total", "Status", "Date"], orderExportRows())}>Print / Save PDF ({filteredReportRecords("orders", orders).length})</button>
          <button type="button" onClick={() => exportReport("image", "Orders report", ["Order", "Customer", "Phone", "Items", "Total", "Status", "Date"], orderExportRows())}>Download image ({filteredReportRecords("orders", orders).length})</button>
        </div>

        <input
          className="admin-search"
          placeholder="Search orders by ID, customer, phone or status"
          value={
            tableSearch.orders
          }
          onChange={(event) =>
            setTableSearchValue(
              "orders",
              event.target.value
            )
          }
        />


        <div className="admin-table-scroll">

          <table className="admin-table">

            <thead>

              <tr>
                <th>
                  Order
                </th>

                <th>
                  Customer
                </th>

                <th>
                  Total
                </th>

                <th>
                  Status
                </th>

                <th>
                  Shipment tracking
                </th>

                <th>
                  Contact
                </th>

                <th>
                  Update
                </th>
              </tr>

            </thead>


            <tbody>

              {paged(
                orders,
                "orders"
              ).rows.map(
                (order) => (

                  <React.Fragment
                    key={
                      order._id
                    }
                  >

                    <tr
                      className="order-click-row"
                      onClick={() =>
                        setExpandedOrder(
                          expandedOrder ===
                            order._id
                            ? null
                            : order._id
                        )
                      }
                    >

                      <td>

                        #
                        {order._id
                          .slice(
                            -8
                          )
                          .toUpperCase()}

                        <small>
                          {new Date(
                            order.createdAt
                          ).toLocaleDateString(
                            "en-IN"
                          )}
                        </small>

                      </td>


                      <td>

                        {
                          order
                            .shippingAddress
                            ?.name ||
                          order
                            .customer
                            ?.name
                        }

                        <small>

                          {
                            order
                              .shippingAddress
                              ?.phone ||
                            order
                              .customer
                              ?.phone
                          }

                          <br />

                          {
                            order
                              .shippingAddress
                              ?.email ||
                            order
                              .customer
                              ?.email
                          }

                        </small>

                      </td>


                      <td>

                        Rs.{" "}
                        {Number(
                          order.total ||
                            0
                        ).toLocaleString(
                          "en-IN"
                        )}

                      </td>


                      <td>

                        <select
                          value={normalizedOrderStatus(order.status)}
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                          onChange={(
                            event
                          ) =>
                            updateOrder(
                              order,
                              "status",
                              event.target
                                .value
                            )
                          }
                        >

                          {orderPhases.map(([status, label]) => (
                            <option key={status} value={status}>{label}</option>
                          ))}

                        </select>
                        {normalizedOrderStatus(order.status) === "cancelled_refund" && (
                          <small className="refund-admin-note">Process payment refunds through the payment provider separately.</small>
                        )}

                      </td>


                      <td>

                        <input
                          className="tracking-input"
                          defaultValue={
                            order.trackingNumber ||
                            ""
                          }
                          placeholder="Tracking number"
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                          onBlur={(
                            event
                          ) =>
                            updateOrder(
                              order,
                              "trackingNumber",
                              event.target
                                .value
                            )
                          }
                        />


                        <input
                          className="tracking-input"
                          defaultValue={
                            order.carrier ||
                            ""
                          }
                          placeholder="Carrier"
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                          onBlur={(
                            event
                          ) =>
                            updateOrder(
                              order,
                              "carrier",
                              event.target
                                .value
                            )
                          }
                        />

                      </td>


                      {/* ==================================================
                          CONTACT BUTTONS
                      =================================================== */}

                      <td
                        className="order-contact-actions"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >

                        <button
                          type="button"
                          className="contact-button whatsapp-button"
                          title="Send order details on WhatsApp"
                          aria-label="Send order details on WhatsApp"
                          onClick={() =>
                            openWhatsApp(
                              order
                            )
                          }
                        >
                          <MessageCircle
                            size={16}
                          />

                          WhatsApp
                        </button>


                        <button
                          type="button"
                          className="contact-button email-button"
                          title="Send structured HTML order email"
                          aria-label="Send structured HTML order email"
                          onClick={() =>
                            sendStructuredEmail(
                              order
                            )
                          }
                        >
                          <Mail
                            size={16}
                          />

                          Email
                        </button>

                      </td>


                      <td>
                        {order.paymentMethod}
                      </td>

                    </tr>


                    {/* ==================================================
                        EXPANDED ORDER
                    =================================================== */}

                    {expandedOrder ===
                      order._id && (

                      <tr className="order-detail-row">

                        <td
                          colSpan="7"
                        >

                          <div className="order-detail-panel">

                            <div className="order-detail-items">

                              <h4>
                                Products in this order
                              </h4>


                              {(
                                order.items ||
                                []
                              ).map(
                                (
                                  item,
                                  index
                                ) => (

                                  <div
                                    className="order-item-detail"
                                    key={`${item.productId}-${index}`}
                                  >

                                    {item.image && (
                                      <img
                                        src={
                                          item.image
                                        }
                                        alt=""
                                      />
                                    )}


                                    <div>

                                      <strong>
                                        {
                                          item.title
                                        }
                                      </strong>


                                      <span>
                                        Qty:{" "}
                                        {
                                          item.quantity
                                        }

                                        {
                                          item.size &&
                                          ` | Size: ${item.size}`
                                        }

                                        {
                                          item.color &&
                                          ` | Shade: ${item.color}`
                                        }
                                      </span>


                                      <b>
                                        Rs.{" "}
                                        {(
                                          Number(
                                            item.price ||
                                              0
                                          ) *
                                          Number(
                                            item.quantity ||
                                              0
                                          )
                                        ).toLocaleString(
                                          "en-IN"
                                        )}
                                      </b>

                                    </div>

                                  </div>

                                )
                              )}

                            </div>


                            {/* ==================================================
                                ORDER META
                            =================================================== */}

                            <div className="order-detail-meta">

                              <p>

                                <strong>
                                  Billing /
                                  delivery
                                </strong>

                                <br />

                                {
                                  order
                                    .shippingAddress
                                    ?.name
                                }

                                <br />

                                {
                                  order
                                    .shippingAddress
                                    ?.phone
                                }

                                <br />

                                {
                                  order
                                    .shippingAddress
                                    ?.email
                                }

                                <br />

                                {
                                  order
                                    .shippingAddress
                                    ?.address
                                }

                                ,{" "}

                                {
                                  order
                                    .shippingAddress
                                    ?.city
                                }

                                ,{" "}

                                {
                                  order
                                    .shippingAddress
                                    ?.state
                                }

                                {" - "}

                                {
                                  order
                                    .shippingAddress
                                    ?.pinCode
                                }

                              </p>

                              {order.editedAt && (
                                <p className="admin-order-edited-note">
                                  Edited by store · {new Date(order.editedAt).toLocaleString("en-IN")}
                                </p>
                              )}

                              {editingOrderId === order._id ? (
                                <form className="order-address-editor" onSubmit={(event) => { event.preventDefault(); saveOrderAddress(order); }}>
                                  {[
                                    ["name", "Customer name"],
                                    ["phone", "Phone"],
                                    ["email", "Email"],
                                    ["address", "Street address"],
                                    ["city", "City"],
                                    ["state", "State"],
                                    ["pinCode", "PIN code"],
                                  ].map(([field, label]) => (
                                    <label key={field}>{label}
                                      <input
                                        required={field !== "email"}
                                        value={orderAddressDraft?.[field] || ""}
                                        onChange={(event) => setOrderAddressDraft((current) => ({ ...current, [field]: event.target.value }))}
                                      />
                                    </label>
                                  ))}
                                  <div className="order-address-editor-actions">
                                    <button type="submit">Save edited details</button>
                                    <button type="button" onClick={() => { setEditingOrderId(""); setOrderAddressDraft(null); }}>Cancel</button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  className="edit-order-details-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setEditingOrderId(order._id);
                                    setOrderAddressDraft({ name: "", phone: "", email: "", address: "", city: "", state: "", pinCode: "", ...order.shippingAddress });
                                  }}
                                >
                                  Edit customer / delivery information
                                </button>
                              )}

                              {/* ==================================================
                                  ORDER ACTIONS
                              =================================================== */}

                              <div className="order-detail-actions">

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPrintOrder(order);
                                  }}
                                >
                                  <Printer size={15} />
                                  Print order
                                </button>

                                <button
                                  type="button"
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    sendStructuredEmail(
                                      order
                                    );
                                  }}
                                >

                                  <Mail
                                    size={15}
                                  />

                                  Send structured
                                  email

                                </button>


                                <button
                                  type="button"
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    openWhatsApp(
                                      order
                                    );
                                  }}
                                >

                                  <MessageCircle
                                    size={15}
                                  />

                                  WhatsApp

                                </button>


                                <button
                                  type="button"
                                  className="danger-button"
                                  disabled={deletingOrderId === order._id}
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    deleteOrder(
                                      order
                                    );
                                  }}
                                >
                                  {deletingOrderId === order._id ? "Deleting…" : "Delete order"}
                                </button>

                              </div>

                            </div>

                          </div>

                        </td>

                      </tr>

                    )}

                  </React.Fragment>

                )
              )}

            </tbody>

          </table>


          <Pagination
            {...paged(
              orders,
              "orders"
            )}
            onChange={(value) =>
              setPages(
                (current) => ({
                  ...current,
                  orders:
                    value,
                })
              )
            }
          />

        </div>

      </section>
      </div>

      {printOrder && createPortal(
        <article className="order-print-sheet" aria-label="Printable order invoice">
          <header className="order-print-header">
            <div>
              <p className="order-print-brand">Kashmir Cloth Stores</p>
              <p>Order invoice</p>
            </div>
            <div className="order-print-number">
              <strong>Order #{printOrder._id.slice(-8).toUpperCase()}</strong>
              <span>
                Placed{" "}
                {printOrder.createdAt
                  ? new Date(printOrder.createdAt).toLocaleString("en-IN")
                  : "Date not recorded"}
              </span>
            </div>
          </header>

          <div className="order-print-info">
            <section>
              <h3>Delivery address</h3>
              <strong>{printableAddress.name || printOrder.customer?.name || "Customer"}</strong>
              <span>{printableAddress.address || "Address not recorded"}</span>
              <span>
                {[printableAddress.city, printableAddress.state, printableAddress.pinCode]
                  .filter(Boolean)
                  .join(", ") || "City / region not recorded"}
              </span>
              <span>Phone: {printableAddress.phone || printOrder.customer?.phone || "Not recorded"}</span>
              {(printableAddress.email || printOrder.customer?.email) && (
                <span>Email: {printableAddress.email || printOrder.customer?.email}</span>
              )}
            </section>

            <section>
              <h3>Order and payment</h3>
              <span>Order status: {printableStatus}</span>
              <span>Payment method: {formatPaymentMethod(printOrder.paymentMethod)}</span>
              <span>Payment status: {printablePaymentStatus}</span>
              {printOrder.paymentId && <span>Payment reference: {printOrder.paymentId}</span>}
              {printOrder.trackingNumber && (
                <span>
                  Tracking: {[printOrder.carrier, printOrder.trackingNumber].filter(Boolean).join(" ")}
                </span>
              )}
            </section>
          </div>

          <table className="order-print-items">
            <thead>
              <tr>
                <th>Item</th>
                <th>Options</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {printableItems.map((item, index) => (
                <tr key={`${item.productId || item.title}-${index}`}>
                  <td>{item.title || "Product"}</td>
                  <td>{[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{Number(item.quantity || 0)}</td>
                  <td>Rs. {Number(item.price || 0).toLocaleString("en-IN")}</td>
                  <td>Rs. {(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="order-print-totals">
            <div><span>Items subtotal</span><strong>Rs. {printableSubtotal.toLocaleString("en-IN")}</strong></div>
            {Math.abs(printableAdjustment) > 0.01 && (
              <div>
                <span>Order adjustment</span>
                <strong>
                  {printableAdjustment < 0 ? "−" : "+"} Rs. {Math.abs(printableAdjustment).toLocaleString("en-IN")}
                </strong>
              </div>
            )}
            <div className="order-print-grand-total"><span>Order total</span><strong>Rs. {printableTotal.toLocaleString("en-IN")}</strong></div>
          </div>
          <p className="order-print-footer">Thank you for shopping with Kashmir Cloth Stores.</p>
        </article>,
        document.body
      )}

      {/* ======================================================
          CUSTOMERS
      ======================================================= */}

      <div className="admin-page-area admin-customers-area">
      <section className="admin-section">

        <h3>
          Customers ({
            customers.length
          })
        </h3>

        <form className="admin-form customer-create-form" onSubmit={createCustomer}>
          <h4>Save customer information</h4>
          <div className="admin-grid">
            <label>Name
              <input required maxLength="100" value={newCustomerDraft.name} onChange={(event) => setNewCustomerDraft((draft) => ({ ...draft, name: event.target.value }))} />
            </label>
            <label>Phone
              <input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number." required maxLength="10" value={newCustomerDraft.phone} onChange={(event) => setNewCustomerDraft((draft) => ({ ...draft, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))} />
            </label>
            <label>Email
              <input type="email" required maxLength="254" value={newCustomerDraft.email} onChange={(event) => setNewCustomerDraft((draft) => ({ ...draft, email: event.target.value.trim() }))} />
            </label>
          </div>
          <button type="submit">Save customer</button>
        </form>

        <ReportDateFilter
          label="Customers date range"
          value={reportFilters.customers}
          onChange={(value) => setReportFilters((current) => ({ ...current, customers: value }))}
        />
        <div className="admin-export-actions" aria-label="Download customers">
          <button type="button" onClick={() => exportReport("pdf", "Customer report", ["Customer ID", "Name", "Phone", "Email", "Marketing consent", "Joined"], customerExportRows())}>Print / Save PDF ({filteredReportRecords("customers", customers).length})</button>
          <button type="button" onClick={() => exportReport("image", "Customer report", ["Customer ID", "Name", "Phone", "Email", "Marketing consent", "Joined"], customerExportRows())}>Download image ({filteredReportRecords("customers", customers).length})</button>
        </div>

        <input
          className="admin-search"
          placeholder="Search customers by ID, name, email or phone"
          value={
            tableSearch.customers
          }
          onChange={(event) =>
            setTableSearchValue(
              "customers",
              event.target.value
            )
          }
        />


        <div className="admin-table-scroll">

          <table className="admin-table">

            <thead>

              <tr>
                <th>Customer ID</th>

                <th>
                  Name
                </th>

                <th>Phone</th>

                <th>Email</th>

                <th>
                  Marketing consent
                </th>

                <th>
                  Joined
                </th>
                <th>Actions</th>
              </tr>

            </thead>


            <tbody>

              {paged(
                customers,
                "customers"
              ).rows.map(
                (customer) => (
                  <React.Fragment key={customer._id}>
                  <tr>

                    <td>{customerDisplayId(customer)}</td>

                    <td>
                      {
                        customer.name
                      }
                    </td>

                    <td>
                      {hasValidCustomerPhone(customer.phone) ? customer.phone : "Needs correction"}
                    </td>

                    <td>
                      {hasValidCustomerEmail(customer.email) ? customer.email : "Needs correction"}

                    </td>

                    <td>
                      {
                        customer.marketingConsent
                          ? "Opted in"
                          : "Not opted in"
                      }
                    </td>

                    <td>
                      {new Date(
                        customer.createdAt
                      ).toLocaleDateString(
                        "en-IN"
                      )}
                    </td>
                    <td className="customer-admin-actions">
                      <button type="button" onClick={() => {
                        setEditingCustomerId(customer._id);
                        setCustomerDraft({
                          name: customer.name || "",
                          phone: hasValidCustomerPhone(customer.phone) ? customer.phone : "",
                          email: hasValidCustomerEmail(customer.email) ? customer.email : "",
                        });
                        setError("");
                      }}>Edit</button>
                      <button type="button" className="danger-button" onClick={() => deleteCustomer(customer)}>Delete data</button>
                    </td>

                  </tr>
                  {editingCustomerId === customer._id && (
                    <tr>
                      <td colSpan="7">
                        <form className="customer-edit-form" onSubmit={(event) => { event.preventDefault(); saveCustomer(); }}>
                          {(!hasValidCustomerPhone(customer.phone) || !hasValidCustomerEmail(customer.email)) && <p className="customer-data-warning">This customer record has invalid contact data. Enter the correct phone and email before saving.</p>}
                          <label>Name<input required maxLength="100" value={customerDraft.name} onChange={(event) => setCustomerDraft((draft) => ({ ...draft, name: event.target.value }))} /></label>
                          <label>Phone<input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number." required maxLength="10" value={customerDraft.phone} onChange={(event) => setCustomerDraft((draft) => ({ ...draft, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))} /></label>
                          <label>Email<input type="email" required maxLength="254" value={customerDraft.email} onChange={(event) => setCustomerDraft((draft) => ({ ...draft, email: event.target.value.trim() }))} /></label>
                          <button type="submit">Save customer details</button>
                          <button type="button" onClick={() => setEditingCustomerId("")}>Cancel</button>
                        </form>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>

                )
              )}

            </tbody>

          </table>


          <Pagination
            {...paged(
              customers,
              "customers"
            )}
            onChange={(value) =>
              setPages(
                (current) => ({
                  ...current,
                  customers:
                    value,
                })
              )
            }
          />

        </div>

      </section>

      <section className="admin-section customer-order-reviews">
        <h3>Customer Product Reviews</h3>
        <p>Verified reviews for delivered orders. Only admins can delete any customer review.</p>
        {reviews.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Rating</th><th>Review</th><th>Photos</th><th>Submitted</th><th>Action</th></tr></thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id}>
                    <td>#{review.order?._id ? review.order._id.slice(-8).toUpperCase() : "—"}</td>
                    <td>{review.product?.title || "Deleted product"}</td>
                    <td>{review.authorName}</td>
                    <td>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</td>
                    <td>{review.text}</td>
                    <td><div className="admin-review-images">{(review.images || []).map((image) => <a key={image.publicId} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt="Customer review" loading="lazy" /></a>)}</div></td>
                    <td>{review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                    <td><button type="button" className="danger-button" onClick={() => deleteCustomerReview(review)}>Delete review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No customer product reviews submitted yet.</p>}
      </section>
      </div>

    </main>
  );
}


// ============================================================
// PAGINATION
// ============================================================

function Pagination({
  page,
  pageCount,
  onChange,
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="admin-pagination">

      <button
        type="button"
        disabled={page === 1}
        onClick={() =>
          onChange(page - 1)
        }
      >
        Previous
      </button>


      <span>
        Page {page} of{" "}
        {pageCount}
      </span>


      <button
        type="button"
        disabled={
          page === pageCount
        }
        onClick={() =>
          onChange(page + 1)
        }
      >
        Next
      </button>

    </div>
  );
}