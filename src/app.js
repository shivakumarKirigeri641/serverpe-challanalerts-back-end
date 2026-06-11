const express = require("express");
const path = require("path");
const cors = require("cors");
const publicRouter = require("./routers/publicRouter");
const adminRouter = require("./routers/adminRouter");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { connectDB } = require("./database/connectDB");
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
app.use(
  "/serverpe/platform/alertmyvahan/private/restricted/auth/admin",
  adminRouter,
);
app.use("/serverpe/platform/alertmyvahan/public/user", publicRouter);
/* DB connections */
connectDB();
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
