const cron = require("node-cron");
const { connectDB } = require("../database/connectDB");
const updateRemainingDays = require("../repos/jobs/updateRemainingDays");
const handleAlertingSubscribers = require("../repos/jobs/handleAlertingSubscribers");
const handleAlertingSubscribersFromDocuments = require("../repos/jobs/handleAlertingSubscribersFromDocuments");
const simulateFastDays = require("../repos/jobs/simulateFastDays");
const pool = connectDB();
/**
 * Daily scheduler — runs `dailyTask` once a day at 09:00 IST (Asia/Kolkata),
 * regardless of the server's own timezone. Call once on server boot (app.js).
 *
 * Write your daily job logic inside dailyTask(). Job modules you can call:
 *   require("../repos/jobs/recalcRcExpiryDays")     // refresh remaining-days
 *   require("../repos/jobs/incrementFeedbackDays")
 *   require("../repos/jobs/dailyAlerts")            // RC/doc/feedback/VDH alerts
 */

// "minute hour day-of-month month day-of-week" → 09:00 every day.
//const DAILY_9AM = "0 9 * * *";
const DAILY_9AM = "*/10 * * * * *"; // every 30s — handy for local testing
const TIMEZONE = "Asia/Kolkata";

/** TODO(you): the work to run every day at 09:00 IST. */
const dailyTask = async () => {
  try {
    // TODO: implement your daily job here.
    await simulateFastDays(pool);
    //await updateRemainingDays(pool);
    //await handleAlertingSubscribers(pool);
    //await handleAlertingSubscribersFromDocuments(pool);
  } catch (err) {
    console.error("Daily 09:00 IST job failed:", err.message);
  }
};

/** Register the daily 09:00 IST schedule. Call once on boot. */
const scheduleDailyJobs = () => {
  cron.schedule(DAILY_9AM, dailyTask, { timezone: TIMEZONE });
  console.log(`Daily job scheduled: "${DAILY_9AM}" (${TIMEZONE})`);
};

module.exports = scheduleDailyJobs;
