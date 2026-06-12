const cron = require("node-cron");
const { connectDB } = require("../database/connectDB");
const updateRemainingDays = require("../repos/jobs/updateRemainingDays");
const handleAlertingSubscribers = require("../repos/jobs/handleAlertingSubscribers");
const handleAlertingSubscribersFromDocuments = require("../repos/jobs/handleAlertingSubscribersFromDocuments");
const handleVdhReport = require("../repos/jobs/handleVdhReport");
const simulateFastDays = require("../repos/jobs/simulateFastDays");
const pool = connectDB();

/**
 * Daily scheduler. Two modes, chosen by the SIMULATE_FAST_DAYS env flag:
 *
 *   • PRODUCTION (default / SIMULATE_FAST_DAYS != "true"):
 *       runs the REAL jobs once a day at 09:00 IST ("0 9 * * *").
 *
 *   • FAST-SIM (SIMULATE_FAST_DAYS = "true"):
 *       runs simulateFastDays every 10s, so one "day" passes per tick for local
 *       testing. (Pair with SKIP_RC_REFRESH=true to avoid billed RC API calls.)
 *
 * Call scheduleDailyJobs() once on server boot (app.js).
 */
const TIMEZONE = "Asia/Kolkata";
const FAST_SIM =
  String(process.env.SIMULATE_FAST_DAYS).toLowerCase() === "true";

// minute hour day-of-month month day-of-week
const PRODUCTION_CRON = "0 9 * * *"; // 09:00 every day
const FAST_SIM_CRON = "*/10 * * * * *"; // every 10 seconds
const SCHEDULE = FAST_SIM ? FAST_SIM_CRON : PRODUCTION_CRON;

/** The REAL daily task (production). Order matters: decrement first, then alert. */
const dailyTask = async () => {
  try {
    await updateRemainingDays(pool); // refresh/decrement remaining-days first
    await handleAlertingSubscribers(pool); // subscription expiry alerts
    await handleAlertingSubscribersFromDocuments(pool); // document expiry alerts
    await handleVdhReport(pool); // VDH report (every 30 days, self-gated)
  } catch (err) {
    console.error("Daily job failed:", err.message);
  }
};

/** Register the schedule. Call once on boot. */
const scheduleDailyJobs = () => {
  const task = FAST_SIM ? () => simulateFastDays(pool) : dailyTask;
  cron.schedule(SCHEDULE, task, { timezone: TIMEZONE });
  console.log(
    `Daily job scheduled: "${SCHEDULE}" (${TIMEZONE})` +
      (FAST_SIM ? " — ⏩ FAST-SIM mode (simulateFastDays)" : ""),
  );
};

module.exports = scheduleDailyJobs;
