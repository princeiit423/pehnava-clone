const COMPANY_LOGO_URL =
  "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788449875/IMG_20260903_210034_ru7fpz.png";

function getPublicAppBaseUrl() {
  const configuredOrigins = (process.env.CLIENT_ORIGIN || "").split(",");

  for (const origin of configuredOrigins) {
    try {
      const url = new URL(origin.trim());
      if (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      ) {
        return url.origin;
      }
    } catch {
      // Ignore invalid configured origins and try the next one.
    }
  }

  return "https://kashmirclothstores.vercel.app";
}

function getSafeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatRs(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildOrderEmailHtml(order) {
  const publicAppBaseUrl = getPublicAppBaseUrl();
  const address = order.shippingAddress || {};
  const customerName =
    address.name ||
    order.customer?.name ||
    "Customer";

  const orderId = String(order._id || "")
    .slice(-8)
    .toUpperCase();
  const carrier = escapeHtml(order.carrier || "");
  const trackingNumber = escapeHtml(order.trackingNumber || "");

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  // Calculate subtotal from actual order items
  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;

    return sum + price * quantity;
  }, 0);

  // Use actual values if your Order model has them
  const shipping =
    Number(
      order.shipping ??
      order.shippingCost ??
      0
    ) || 0;

  const taxes =
    Number(
      order.tax ??
      order.taxes ??
      0
    ) || 0;

  // Prefer the actual saved order total
  const savedTotal = Number(order.total);

  const calculatedTotal =
    subtotal + shipping + taxes;

  const finalTotal =
    Number.isFinite(savedTotal)
      ? savedTotal
      : calculatedTotal;

  const rows = items
    .map((item) => {
      const quantity =
        Math.max(
          0,
          Number(item.quantity) || 0
        );

      const price =
        Number(item.price) || 0;

      const lineTotal =
        price * quantity;

      const productSlug =
        item.slug ||
        item.productSlug ||
        item.product?.slug;
      const productHref = productSlug
        ? `${publicAppBaseUrl}/products/${encodeURIComponent(String(productSlug))}`
        : "";
      const imageUrl = getSafeImageUrl(item.image);

      const variant = [
        item.color
          ? escapeHtml(item.color)
          : "",
        item.size
          ? escapeHtml(item.size)
          : "",
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <tr>
          <td
            style="
              padding:10px 0;
            "
          >
            <table
              class="email-item"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                background:#fbfaf8;
                border:1px solid #eee9e3;
                border-radius:9px;
              "
            >
              <tr>

                <!-- PRODUCT IMAGE -->
                <td
                  class="email-item-image"
                  width="88"
                  valign="top"
                  style="padding:12px 0 12px 12px;"
                >
                  ${
                    imageUrl
                      ? `
                        ${
                          productHref
                            ? `<a href="${escapeHtml(productHref)}" style="display:block;text-decoration:none;">`
                            : ""
                        }
                          <img
                            src="${escapeHtml(imageUrl)}"
                            width="64"
                            height="80"
                            alt="${escapeHtml(item.title || "Product")}"
                            style="
                              display:block;
                              width:64px;
                              height:80px;
                              object-fit:cover;
                              border-radius:7px;
                              background:#f1eee9;
                              border:0;
                            "
                          >
                        ${productHref ? "</a>" : ""}
                      `
                      : `
                        <span
                          role="img"
                          aria-label="Image unavailable"
                          style="
                            display:block;
                            width:64px;
                            height:80px;
                            border-radius:7px;
                            background:#f1eee9;
                            color:#8b8178;
                            font-size:10px;
                            line-height:80px;
                            text-align:center;
                          "
                        >No image</span>
                      `
                  }
                </td>

                <!-- PRODUCT DETAILS -->
                <td
                  class="email-item-details"
                  valign="top"
                  style="padding:14px 8px 12px 14px;"
                >
                  <p
                    style="
                      margin:0;
                      font-size:14px;
                      line-height:1.45;
                      color:#222222;
                      font-weight:700;
                    "
                  >
                    ${escapeHtml(
                      item.title || "Product"
                    )}
                  </p>

                  ${
                    variant
                      ? `
                        <p
                          style="
                            margin:5px 0 0;
                            font-size:13px;
                            line-height:1.4;
                            color:#777777;
                          "
                        >
                          ${variant}
                        </p>
                      `
                      : ""
                  }

                  <p
                    style="
                      margin:5px 0 0;
                      font-size:13px;
                      line-height:1.4;
                      color:#999999;
                    "
                  >
                    Qty ${quantity}
                  </p>
                </td>

                <!-- PRICE -->
                <td
                  class="email-item-price"
                  width="95"
                  valign="top"
                  align="right"
                  style="padding:14px 12px 12px 8px;"
                >
                  <p
                    style="
                      margin:0;
                      font-size:14px;
                      line-height:1.45;
                      color:#222222;
                      font-weight:600;
                      white-space:nowrap;
                    "
                  >
                    ${formatRs(lineTotal)}
                  </p>
                </td>

              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join("");

  const safeAddress = [
    address.address,
    [
      address.city,
      address.state,
    ]
      .filter(Boolean)
      .join(", "),
    address.pinCode,
    "India",
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  return `<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <style>
    @media only screen and (max-width: 600px) {
      .email-outer {
        padding:16px 8px !important;
      }
      .email-container {
        border-radius:0 !important;
      }
      .email-gutter {
        padding-left:18px !important;
        padding-right:18px !important;
      }
      .email-intro {
        padding-top:18px !important;
        padding-bottom:22px !important;
      }
      .email-intro h2 {
        font-size:21px !important;
      }
      .email-item-image {
        width:76px !important;
        padding-left:8px !important;
      }
      .email-item-image img,
      .email-item-image span {
        width:56px !important;
        height:70px !important;
      }
      .email-item-image span {
        line-height:70px !important;
      }
      .email-item-details {
        padding-left:8px !important;
      }
      .email-item-price {
        width:82px !important;
        padding-right:8px !important;
      }
      .email-customer-column {
        display:block !important;
        width:100% !important;
        padding:0 0 18px !important;
      }
      .email-customer-column:last-child {
        padding-bottom:0 !important;
      }
    }
  </style>

  <title>
    Kashmir Cloth Stores - Order #${escapeHtml(orderId)}
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f4f4;
    font-family:Arial,Helvetica,sans-serif;
    color:#222222;
  "
>

  <table
    class="email-outer"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background:#f4f4f4;
      padding:28px 10px;
    "
  >

    <tr>

      <td align="center">

        <table
          class="email-container"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:600px;
            width:100%;
            background:#ffffff;
            border-radius:8px;
            overflow:hidden;
          "
        >

          <!-- =========================
               BRAND HEADER
          ========================== -->

          <tr>

            <td
              align="center"
              style="
                padding:34px 30px 20px;
              "
            >

              <img
                src="${COMPANY_LOGO_URL}"
                width="140"
                alt="Kashmir Cloth Stores"
                style="
                  display:block;
                  width:140px;
                  max-width:100%;
                  height:auto;
                  margin:0 auto 13px;
                  border:0;
                "
              >

              <h1
                style="
                  margin:0;
                  font-size:22px;
                  line-height:1.3;
                  font-weight:700;
                  letter-spacing:.2px;
                  color:#111111;
                "
              >
                Kashmir Cloth Stores
              </h1>

              <p
                style="
                  margin:8px 0 0;
                  font-size:12px;
                  line-height:1.4;
                  letter-spacing:1.8px;
                  color:#999999;
                "
              >
                ORDER #${escapeHtml(orderId)}
              </p>

            </td>

          </tr>


          <!-- =========================
               THANK YOU MESSAGE
          ========================== -->

          <tr>

            <td
              class="email-intro"
              style="
                padding:20px 40px 28px;
                text-align:center;
              "
            >

              <h2
                style="
                  margin:0;
                  font-size:25px;
                  line-height:1.35;
                  font-weight:700;
                  color:#222222;
                "
              >
                Thank you,
                ${escapeHtml(customerName)},
                for your purchase!
              </h2>

              <p
                style="
                  margin:12px 0 0;
                  font-size:15px;
                  line-height:1.65;
                  color:#666666;
                "
              >
                We're getting your order ready
                to be shipped. We will notify you
                when it has been sent.
              </p>

            </td>

          </tr>

          ${
            order.editedAt
              ? `
                <tr>
                  <td style="padding:0 40px 18px;text-align:center;color:#806541;font-size:12px;line-height:1.5;">
                    Order information updated by our team on ${escapeHtml(new Date(order.editedAt).toLocaleString("en-IN"))}.
                  </td>
                </tr>
              `
              : ""
          }

          ${
            order.status === "cancelled_refund" || order.status === "cancelled"
              ? `
                <tr>
                  <td style="padding:0 40px 18px;text-align:center;color:#806541;font-size:13px;line-height:1.5;">
                    <strong>Order status: Cancelled / Refund.</strong> Any eligible payment refund is processed manually; this status does not issue an automatic refund.
                  </td>
                </tr>
              `
              : ""
          }

          <!-- =========================
               ORDER SUMMARY
          ========================== -->

          ${
            carrier || trackingNumber
              ? `
                <tr>
                  <td class="email-gutter" style="padding:0 40px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f4ef;border:1px solid #e9e1d7;border-radius:8px;">
                      <tr><td style="padding:15px 18px;font-size:13px;line-height:1.6;color:#51483e;">
                        <strong style="display:block;margin-bottom:4px;color:#29231d;">Shipment tracking</strong>
                        ${carrier ? `<span>Tracking Carrier: <strong>${carrier}</strong></span>` : ""}
                        ${carrier && trackingNumber ? "<br>" : ""}
                        ${trackingNumber ? `<span>Tracking Number: <strong>${trackingNumber}</strong></span>` : ""}
                      </td></tr>
                    </table>
                  </td>
                </tr>
              `
              : ""
          }

          <tr>

            <td
              class="email-gutter"
              style="
                padding:26px 40px 10px;
                border-top:1px solid #eeeeee;
              "
            >

              <h3
                style="
                  margin:0;
                  font-size:16px;
                  line-height:1.4;
                  color:#222222;
                "
              >
                Order summary
              </h3>

            </td>

          </tr>


          <tr>

            <td
              class="email-gutter"
              style="
                padding:0 40px;
              "
            >

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                ${
                  rows ||
                  `
                    <tr>
                      <td
                        style="
                          padding:18px 0;
                          color:#777777;
                          font-size:14px;
                        "
                      >
                        No items found in this order.
                      </td>
                    </tr>
                  `
                }

              </table>

            </td>

          </tr>


          <!-- =========================
               PRICE BREAKDOWN
          ========================== -->

          <tr>

            <td
              class="email-gutter"
              style="
                padding:18px 40px 24px;
                border-top:1px solid #eeeeee;
              "
            >

              <table
                width="100%"
                cellpadding="4"
                cellspacing="0"
                border="0"
                style="
                  font-size:14px;
                  line-height:1.5;
                  color:#555555;
                "
              >

                <tr>

                  <td>
                    Subtotal
                  </td>

                  <td align="right">
                    ${formatRs(subtotal)}
                  </td>

                </tr>

                <tr>

                  <td>
                    Shipping
                  </td>

                  <td align="right">
                    ${formatRs(shipping)}
                  </td>

                </tr>

                <tr>

                  <td>
                    Taxes
                  </td>

                  <td align="right">
                    ${formatRs(taxes)}
                  </td>

                </tr>

                <tr>

                  <td
                    style="
                      border-top:1px solid #eeeeee;
                      padding-top:12px;
                      font-weight:700;
                      font-size:16px;
                      color:#222222;
                    "
                  >
                    Total
                  </td>

                  <td
                    align="right"
                    style="
                      border-top:1px solid #eeeeee;
                      padding-top:12px;
                      font-weight:700;
                      font-size:16px;
                      color:#222222;
                    "
                  >
                    ${formatRs(finalTotal)}
                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =========================
               CUSTOMER INFORMATION
          ========================== -->

          <tr>

            <td
              class="email-gutter"
              style="
                padding:24px 40px;
                border-top:1px solid #eeeeee;
              "
            >

              <h3
                style="
                  margin:0 0 18px;
                  font-size:16px;
                  line-height:1.4;
                  color:#222222;
                "
              >
                Customer information
              </h3>


              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <!-- SHIPPING ADDRESS -->

                  <td
                    class="email-customer-column"
                    width="50%"
                    valign="top"
                    style="
                      padding-right:15px;
                    "
                  >

                    <p
                      style="
                        margin:0 0 7px;
                        font-size:14px;
                        font-weight:700;
                        color:#222222;
                      "
                    >
                      Shipping address
                    </p>

                    <p
                      style="
                        margin:0;
                        font-size:13px;
                        line-height:1.65;
                        color:#555555;
                      "
                    >

                      ${escapeHtml(
                        address.name ||
                        customerName
                      )}

                      ${
                        address.phone
                          ? `<br>${escapeHtml(
                              address.phone
                            )}`
                          : ""
                      }

                      ${
                        address.email
                          ? `<br>${escapeHtml(
                              address.email
                            )}`
                          : ""
                      }

                      ${
                        safeAddress
                          ? `<br>${safeAddress}`
                          : ""
                      }

                    </p>

                  </td>


                  <!-- PAYMENT -->

                  <td
                    class="email-customer-column"
                    width="50%"
                    valign="top"
                    style="
                      padding-left:15px;
                    "
                  >

                    <p
                      style="
                        margin:0 0 7px;
                        font-size:14px;
                        font-weight:700;
                        color:#222222;
                      "
                    >
                      Payment method
                    </p>

                    <p
                      style="
                        margin:0;
                        font-size:13px;
                        line-height:1.65;
                        color:#555555;
                      "
                    >

                      ${escapeHtml(
                        order.paymentMethod ||
                        "Not specified"
                      )}

                      ${
                        order.status
                          ? `
                            <br>
                            <br>
                            <strong>
                              Status:
                            </strong>
                            ${escapeHtml(
                              order.status
                            )}
                          `
                          : ""
                      }

                    </p>

                  </td>

                </tr>

              </table>

            </td>

          </tr>


          <!-- =========================
               FOOTER
          ========================== -->

          <tr>

            <td
              align="center"
              style="
                padding:26px 30px 30px;
                border-top:1px solid #eeeeee;
                background:#fafafa;
              "
            >

              <p
                style="
                  margin:0;
                  font-size:15px;
                  font-weight:700;
                  color:#222222;
                "
              >
                Kashmir Cloth Stores
              </p>

              <p
                style="
                  margin:7px 0 0;
                  font-size:12px;
                  line-height:1.5;
                  color:#888888;
                "
              >
                Main Road, Phusro • Jharkhand
              </p>

              <p
                style="
                  margin:10px 0 0;
                  font-size:12px;
                  line-height:1.5;
                  color:#888888;
                "
              >
                Questions? Reply to this email
                or contact us at

                <a
                  href="mailto:amaanhussain786pr@gmail.com"
                  style="
                    color:#222222;
                    text-decoration:none;
                    font-weight:600;
                  "
                >
                  amaanhussain786pr@gmail.com
                </a>

              </p>

            </td>

          </tr>

        </table>

      </td>

    </tr>

  </table>

</body>
</html>`;
}