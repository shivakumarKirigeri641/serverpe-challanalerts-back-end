const crypto = require("crypto");

/**
 * Generate a cryptographically-random 4-digit OTP as a string.
 *
 * Returns the full range 0000–9999, zero-padded so the length is always 4
 * (e.g. "0042"). Uses crypto.randomInt for unbiased, secure randomness.
 */
function generateOTP() {
  return String(crypto.randomInt(1111, 9990)).padStart(4, "0");
}

module.exports = { generateOTP };
