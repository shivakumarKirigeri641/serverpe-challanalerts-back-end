const { verifyToken } = require("../utils/adminToken");

/**
 * Protects admin routes. Accepts the session token from either the
 * `admin_token` cookie or an `Authorization: Bearer <token>` header.
 * On success attaches the decoded payload to `req.admin`.
 */
function authMiddleware(req, res, next) {
  let token = req.cookies?.admin_token;
  if (!token) {
    const header = req.headers?.authorization || "";
    if (header.startsWith("Bearer ")) token = header.slice(7).trim();
  }

  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({
      statuscode: 401,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: "Unauthorized. Please log in again.",
    });
  }

  req.admin = payload;
  next();
}

module.exports = authMiddleware;
