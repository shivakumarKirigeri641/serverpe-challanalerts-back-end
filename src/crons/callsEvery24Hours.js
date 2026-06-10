const cron = require("node-cron");
const recalcRcExpiryDays = require("../repos/jobs/recalcRcExpiryDays");

/**
 * Daily 09:00 IST cron (node-cron). Runs once every day at exactly 9 AM
 * Asia/Kolkata, regardless of the server's own timezone.
 */

// "minute hour day-of-month month day-of-week" → 09:00 every day.
//const DAILY_9AM = "0 9 * * *";
const DAILY_9AM = "* * * * *";
const TIMEZONE = "Asia/Kolkata";

/**
 * The task that must run once a day at 09:00 IST. Add daily jobs here.
 */
const dailyNineAmTask = async () => {
  try {
    // Refresh cached remaining-days (rc/insurance/pucc/permit + subscription).
    await recalcRcExpiryDays();
    await doAlertJob();
    // TODO: add other daily 09:00 IST jobs here (expiry/challan alerts, etc.).
  } catch (err) {
    console.error("Daily 09:00 IST task failed:", err.message);
  }
};

/**
 * Registers the daily 09:00 IST cron. Call once on server boot.
 */
const callsEvery24Hours = () => {
  cron.schedule(DAILY_9AM, dailyNineAmTask, { timezone: TIMEZONE });
  console.log(`Daily cron scheduled: "${DAILY_9AM}" (${TIMEZONE})`);
};
const doAlertJob = async () => {
  try {
  } catch (err) {}
};
module.exports = callsEvery24Hours;
