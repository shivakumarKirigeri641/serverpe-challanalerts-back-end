const { encrypt, decrypt, hasKey } = require("../utils/crypto");

/**
 * Transparent payload encryption for the public API.
 *
 *  - REQUEST: if the JSON body is an encrypted envelope `{ data: "<token>" }`,
 *    decrypt it in place so route handlers see plain `req.body`. Plain bodies
 *    and non-JSON bodies (multipart uploads) pass through untouched.
 *
 *  - RESPONSE: `res.json(obj)` is wrapped so the body goes out as
 *    `{ data: "<token>" }`. Binary/file responses (res.sendFile, res.send with
 *    a Buffer) are not affected — they never call res.json.
 *
 * If no SECRET_KEY_VEHCILEOWNER is configured, the middleware is a no-op so the
 * app still runs in plaintext (useful for local debugging).
 */
function cryptoMiddleware(req, res, next) {
  if (!hasKey()) return next();

  // --- decrypt incoming request body ---
  try {
    const body = req.body;
    if (
      body &&
      typeof body === "object" &&
      typeof body.data === "string" &&
      Object.keys(body).length === 1
    ) {
      req.body = decrypt(body.data);
    }
  } catch (err) {
    return res.status(400).json({
      statuscode: 400,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: "Malformed encrypted request payload",
    });
  }

  // --- encrypt outgoing JSON response ---
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    try {
      return originalJson({ data: encrypt(payload) });
    } catch (err) {
      // Never leak plaintext if encryption fails — return an opaque error.
      return originalJson({
        data: encrypt({
          statuscode: 500,
          successstatus: false,
          message: "Response encryption failed",
        }),
      });
    }
  };

  next();
}

module.exports = cryptoMiddleware;
