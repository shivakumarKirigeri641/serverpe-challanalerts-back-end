const insertApiLog = require("../repos/insertions/insertApiLog");

/* Keys we never want to persist in plaintext inside request_body. */
const SENSITIVE_KEYS = [
  "otp",
  "password",
  "razorpay_signature",
  "razorpay_payment_id",
];

/* Shallow-clone the (already decrypted) body, redacting sensitive fields. */
function sanitizeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const clone = {};
  for (const [key, value] of Object.entries(body)) {
    clone[key] = SENSITIVE_KEYS.includes(key.toLowerCase())
      ? "***redacted***"
      : value;
  }
  return Object.keys(clone).length ? clone : null;
}

/* Lightweight UA parse — no external lookups (this runs on every request). */
function parseDevice(ua = "") {
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome/i.test(ua)) browser = "Google Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";

  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone/i.test(ua)) os = "iOS (iPhone)";
  else if (/ipad/i.test(ua)) os = "iOS (iPad)";
  else if (/linux/i.test(ua)) os = "Linux";

  let deviceType = "Desktop/Laptop";
  if (/mobile|iphone|android.*mobile/i.test(ua)) deviceType = "Mobile";
  else if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) deviceType = "Tablet";

  return `${deviceType} | ${os} | ${browser}`;
}

/**
 * Logs every public API request as user activity into api_logs.
 *
 * Mount this AFTER cryptoMiddleware so req.body is already decrypted. It records
 * on the response "finish" event (after the response is sent) so it never adds
 * latency to the request, and insertion is fire-and-forget so a logging failure
 * can never break the actual API call.
 */
function apiLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const body = sanitizeBody(req.body);
    const ua = req.headers["user-agent"] || null;
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const hasQuery = req.query && Object.keys(req.query).length > 0;

    // Fire-and-forget; insertApiLog swallows its own errors.
    insertApiLog({
      method: req.method,
      endpoint: (req.originalUrl || req.url || "").split("?")[0],
      mobile_number: body?.mobile_number || null,
      vehicle_number: body?.vehicle_number || body?.new_vehicle_number || null,
      ip_address: ipAddress,
      device_info: ua ? parseDevice(ua) : null,
      user_agent: ua,
      request_body: body,
      query_params: hasQuery ? req.query : null,
      status_code: res.statusCode,
      response_time_ms: Date.now() - startedAt,
    });
  });

  next();
}

module.exports = apiLogger;
