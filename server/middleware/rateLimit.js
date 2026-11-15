import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

export function createRateLimiter({
  limit,
  windowMs = WINDOW_MS,
  message = "Too many requests. Please try again later.",
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
  });
}

export const apiRateLimiter = createRateLimiter({ limit: 600 });

export const customerAuthRateLimiter = createRateLimiter({
  limit: 10,
  message: "Too many sign-in or registration attempts. Please try again in 15 minutes.",
});

export const adminLoginRateLimiter = createRateLimiter({
  limit: 5,
  message: "Too many admin login attempts. Please try again in 15 minutes.",
});

export const checkoutRateLimiter = createRateLimiter({
  limit: 20,
  message: "Too many checkout attempts. Please try again in 15 minutes.",
});

export const reviewUploadRateLimiter = createRateLimiter({
  limit: 5,
  message: "Too many review submissions. Please try again in 15 minutes.",
});
