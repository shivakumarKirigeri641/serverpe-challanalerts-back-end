const cron = require("node-cron");
const recalcRcExpiryDays = require("../repos/jobs/recalcRcExpiryDays");
// 🚫 Challan API disabled — challan_days counter no longer advanced.
// const incrementChallanDays = require("../repos/jobs/incrementChallanDays");
const incrementFeedbackDays = require("../repos/jobs/incrementFeedbackDays");
const dailyAlerts = require("../repos/jobs/dailyAlerts");

/**
 * Daily 09:00 IST cron (node-cron). Runs once every day at exactly 9 AM
 * Asia/Kolkata, regardless of the server's own timezone.
 */

// "minute hour day-of-month month day-of-week" → 09:00 every day.
const DAILY_9AM = "0 9 * * *";
//const DAILY_9AM = "* * * * *";
const TIMEZONE = "Asia/Kolkata";

/**
 * The task that must run once a day at 09:00 IST. Add daily jobs here.
 */
const dailyNineAmTask = async () => {
  try {
    // Refresh cached remaining-days (rc/insurance/pucc/permit + subscription).
    await recalcRcExpiryDays();
    // Advance the daily feedback_days counter (mod 28) BEFORE alerting.
    // 🚫 Challan API disabled — challan_days counter tick removed.
    // await incrementChallanDays();
    await incrementFeedbackDays();
    // Subscription / document / feedback / VDH WhatsApp alerts.
    await doAlertJob();
    // TODO: add other daily 09:00 IST jobs here.
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
    await dailyAlerts();
  } catch (err) {
    console.error("doAlertJob failed:", err.message);
  }
};
module.exports = callsEvery24Hours;
