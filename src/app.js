const express = require("express");
const path = require("path");
const cors = require("cors");
const publicRouter = require("./routers/publicRouter");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { connectDB } = require("./database/connectDB");
const { globalLimiter } = require("./utils/rateLimiters");
const cryptoMiddleware = require("./middlewares/cryptoMiddleware");
const apiLogger = require("./middlewares/apiLogger");
const backupApiLogs = require("./repos/jobs/backupApiLogs");
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
  "http://localhost:5173",
  "http://localhost:3000",
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : defaultOrigins;
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
/* 📝 apiLogger runs after cryptoMiddleware so req.body is already decrypted;
   it records every request as user activity in api_logs (fire-and-forget). */
app.use(
  "/vehicleowneralerts/platform/public",
  globalLimiter,
  cryptoMiddleware,
  apiLogger,
  publicRouter,
);
/* DB connections */
connectDB();

/* 📦 api_logs archival: tick daily, but the job itself only writes a CSV +
   prunes the DB once every ~30 days (Node timers can't hold a 30-day delay).
   Runs once on boot too, so a restart never misses a due backup. */
const API_LOG_BACKUP_TICK_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  backupApiLogs().catch(() => {});
}, API_LOG_BACKUP_TICK_MS);
backupApiLogs().catch(() => {});

// const RESERVATION_SWEEP_INTERVAL_MS =
//   Number(process.env.RESERVATION_SWEEP_INTERVAL_MIN || 5) * 60 * 1000;
// setInterval(() => {
//   sweepStaleReservations().catch(() => {});
// }, RESERVATION_SWEEP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
