import { buildOrderEmailHtml } from "./orderEmail.js";

export async function notifyOrder(order, event) {
  const address = order.shippingAddress || {};
  const phaseLabels = {
    order_placed: "Order Placed",
    payment_confirmed: "Payment Confirmed",
    processing_packed: "Processing / Packed",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled_refund: "Cancelled / Refund",
    pending: "Order Placed",
    paid: "Payment Confirmed",
    processing: "Processing / Packed",
  };
  const statusLabel = phaseLabels[order.status] || order.status;
  const tracking = [
    order.carrier ? `Tracking Carrier: ${order.carrier}` : "",
    order.trackingNumber ? `Tracking Number: ${order.trackingNumber}` : "",
  ].filter(Boolean).join(" | ");
  const eventMessage = event === "created"
    ? "received"
    : event === "details"
      ? "customer / delivery details were updated by our team"
      : event === "tracking"
        ? "has shipment tracking updated"
        : `is now ${statusLabel}`;
  const message = `Kashmir Cloth Stores order #${String(order._id).slice(-8).toUpperCase()} ${eventMessage}. Total: Rs. ${Number(order.total).toLocaleString("en-IN")}${tracking ? ` ${tracking}` : ""}`;
  const tasks = [];
  if (process.env.RESEND_API_KEY && address.email) tasks.push(fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM || "orders@kashmirclothstores.example", to: [address.email], subject: `Kashmir Cloth Stores order #${String(order._id).slice(-8).toUpperCase()} update`, html: buildOrderEmailHtml(order) }) }));
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && address.phone) tasks.push(fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: address.phone.replace(/^\+/, ""), type: "text", text: { body: message } }) }));
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && address.phone) tasks.push(fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: address.phone, From: process.env.TWILIO_FROM, Body: message }) }));
  await Promise.allSettled(tasks);
}