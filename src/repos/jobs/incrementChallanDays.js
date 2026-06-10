const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Daily rc_details.challan_days counter tick.
 *
 * Advances every vehicle's challan_days by 1 each day. When the counter would
 * reach 16 it wraps back to 0, so the value cycles 0 → 15 → 0 on a 16-day
 * period. NULL counters are treated as 0 (so they become 1).
 *
 * NOTE: unlike recalcRcExpiryDays this is NOT idempotent — it is a running
 * counter, so it must be fired exactly once per day (one daily cron tick).
 *
 * Fire-and-forget; the caller swallows errors.
 */
const incrementChallanDays = async () => {
  try {
    const res = await pool.query(`
      UPDATE rc_details SET
        challan_days = (COALESCE(challan_days, 0) + 1) % 16;
    `);
    console.log(
      `rc_details challan_days incremented: ${res.rowCount} row(s) updated`,
    );
    return { challanDaysUpdated: res.rowCount };
  } catch (err) {
    console.error("incrementChallanDays failed:", err.message);
    throw err;
  }
};

module.exports = incrementChallanDays;
