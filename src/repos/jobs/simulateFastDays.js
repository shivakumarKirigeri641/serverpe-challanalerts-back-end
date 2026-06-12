const updateRemainingDays = require("./updateRemainingDays");
const handleAlertingSubscribers = require("./handleAlertingSubscribers");
const handleVdhReport = require("../jobs/handleVdhReport");
const handleAlertingSubscribersFromDocuments = require("./handleAlertingSubscribersFromDocuments");

/**
 * ⚠️ TEST-ONLY — simulates "1 day per tick" so you can watch the daily jobs run
 * in seconds instead of waiting real days. NEVER call this in production.
 *
 * It does NOT modify any of the real job files. Each tick it just:
 *   1) Rewinds the once-per-day guards to "yesterday" (last_decremented_on) and
 *      clears today's alert dedup markers (message_logs SUB_/DOC_ rows), so the
 *      real jobs behave as if a brand-new day started.
 *   2) Runs the REAL jobs unchanged → remaining-days drop by 1 and alerts get
 *      re-evaluated against the (now lower) values.
 *
 * Wire it into a 10s cron INSTEAD of the real dailyTask while testing.
 *
 * @param {import('pg').Pool} pool
 */
const simulateFastDays = async (pool) => {
  try {
    console.warn(
      "⏩ [simulateFastDays] TEST MODE — simulating one day this tick",
    );

    // 1) Pretend a new day started: rewind the decrement guards to yesterday...
    await pool.query(
      `update rc_details set last_decremented_on = CURRENT_DATE - 1`,
    );
    await pool.query(
      `update user_subscribed set last_decremented_on = CURRENT_DATE - 1`,
    );
    // ...and clear today's alert dedup so alerts can fire again this tick.
    await pool.query(
      `delete from message_logs
        where created_at::date = CURRENT_DATE
          and (comments like 'SUB%' or comments like 'DOC%')`,
    );

    // 2) Run the REAL jobs (unchanged), in the production order.
    //await updateRemainingDays(pool);
    //await handleAlertingSubscribers(pool);
    //await handleAlertingSubscribersFromDocuments(pool);
    await handleVdhReport(pool); // ← VDH report (every 30 days)
  } catch (err) {
    console.error("simulateFastDays failed:", err.message);
  }
};

module.exports = simulateFastDays;
