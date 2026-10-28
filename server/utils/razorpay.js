const API_URL = "https://api.razorpay.com/v1";
const REQUEST_TIMEOUT_MS = 15000;

export async function requestRazorpay(path, { method = "GET", body } = {}) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("This server requires Node.js 20 or newer for Razorpay payments");
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay is not configured");
    error.status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("Razorpay returned an unreadable response");
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Razorpay did not respond within 15 seconds");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
