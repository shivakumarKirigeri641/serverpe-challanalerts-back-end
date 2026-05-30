const express = require("express");
const path = require("path");
const cors = require("cors");
const publicRouter = require("./routers/publicRouter");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { connectDB } = require("./database/connectDB");
const { globalLimiter } = require("./utils/rateLimiters");
const cryptoMiddleware = require("./middlewares/cryptoMiddleware");
//const sweepStaleReservations = require("./repos/jobs/sweepStaleReservations");
const PORT = process.env.PORT;
const app = express();

/* 🔐 MUST be before CORS & cookies */
app.set("trust proxy", 1);
app.use(express.json());

/* ✅ CORS for cross-subdomain cookies.
   Allowed origins come from CORS_ORIGINS (comma-separated) when set, otherwise
   fall back to the known production domains + local dev. The production frontend
   (alertmyvahan.in) MUST be listed or the browser blocks every API call. */
const defaultOrigins = [
  "https://alertmyvahan.in",
  "https://www.alertmyvahan.in",
  "https://serverpe.in",
  "https://admin.serverpe.in",
  "http://localhost:5173",
  "http://localhost:3000",
];
const allowedOrigins = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : defaultOrigins);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());

/* Static files — NOT rate-limited (images load freely) */
//app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* 🛡️ Global rate-limit + 🔐 transparent payload encryption on the public API.
   Order: rate-limit first (cheap reject), then crypto (decrypt req / encrypt res). */
app.use(
  "/vehicleowneralerts/platform/public",
  globalLimiter,
  cryptoMiddleware,
  publicRouter,
);
/* DB connections */
connectDB();

// const RESERVATION_SWEEP_INTERVAL_MS =
//   Number(process.env.RESERVATION_SWEEP_INTERVAL_MIN || 5) * 60 * 1000;
// setInterval(() => {
//   sweepStaleReservations().catch(() => {});
// }, RESERVATION_SWEEP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
