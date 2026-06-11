const rateLimit = require("express-rate-limit");

const json = (message) => ({
  statuscode: 429,
  powered_by: "ServerPe App Solutions",
  successstatus: false,
  message,
});

/**
 * Global limiter for all public API routes.
 * 100 requests / 15 minutes / IP — generous for normal browsing.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json(json("Too many requests. Please try again in a few minutes.")),
});

/**
 * Strict limiter for sensitive actions (OTP send/verify, payments, contact,
 * feedback). 10 requests / 15 minutes / IP — throttles abuse/brute-force.
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res
      .status(429)
      .json(json("Too many attempts. Please wait a few minutes before trying again.")),
});

module.exports = { globalLimiter, strictLimiter };
