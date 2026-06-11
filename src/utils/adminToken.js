const crypto = require("crypto");
require("dotenv").config();

/**
 * Stateless HMAC-signed session token for the admin.
 *
 * token = base64url(payloadJSON) + "." + base64url(HMAC_SHA256(payloadJSON))
 *
 * The signing key is SECRET_KEY (falls back to SECRET_KEY_VEHCILEOWNER). Tokens
 * carry an `exp` (epoch seconds) so they expire without server-side storage.
 */
const SIGNING_SECRET =
  process.env.SECRET_KEY ||
  process.env.SECRET_KEY_VEHCILEOWNER ||
  "serverpe-admin";

// Default session lifetime: 12 hours.
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const b64urlDecode = (str) =>
  Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );

const sign = (payloadStr) =>
  b64url(
    crypto.createHmac("sha256", SIGNING_SECRET).update(payloadStr).digest(),
  );

/** Create a signed token for the given payload (defaults to a 12h lifetime). */
function createToken(payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadStr = JSON.stringify(body);
  const encodedPayload = b64url(payloadStr);
  return `${encodedPayload}.${sign(payloadStr)}`;
}

/**
 * Verify a token. Returns the decoded payload on success, or null if the
 * signature is invalid, the token is malformed, or it has expired.
 */
function verifyToken(token) {
  try {
    if (!token || typeof token !== "string" || !token.includes("."))
      return null;
    const [encodedPayload, signature] = token.split(".");
    const payloadStr = b64urlDecode(encodedPayload);
    const expected = sign(payloadStr);
    // constant-time compare
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { createToken, verifyToken, DEFAULT_TTL_SECONDS };
