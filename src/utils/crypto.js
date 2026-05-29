const crypto = require("crypto");
require("dotenv").config();

/**
 * AES-256-GCM payload encryption shared by the request/response middleware.
 *
 * Key = SHA-256(SECRET_KEY_VEHCILEOWNER) → 32 bytes.
 * Token = base64( iv[12] | authTag[16] | ciphertext ).
 *
 * The frontend uses the identical scheme so requests/responses are opaque on
 * the wire. (Note: a browser key can't be a true secret — this defeats casual
 * inspection, not a determined reverse-engineer.)
 */
const SECRET = process.env.SECRET_KEY_VEHCILEOWNER || "";
const KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes
const IV_LEN = 12;

/** Encrypt any JSON-serializable value → base64 token string. */
function encrypt(payload) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload ?? null), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypt a base64 token string → original value. Throws on tamper/bad key. */
function decrypt(token) {
  const buf = Buffer.from(String(token), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + 16);
  const ciphertext = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

const hasKey = () => SECRET.length > 0;

module.exports = { encrypt, decrypt, hasKey };
