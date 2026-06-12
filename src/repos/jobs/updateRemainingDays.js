const { connectDB } = require("../../database/connectDB");

/**
 * Daily "remaining days" decrement.
 *
 * WHAT  : Subtracts 1 from each cached remaining-days value once per calendar day:
 *           rc_details : rc_expiry_remaining_datys, insurance_expiry_remaining_datys,
 *                        pucc_expiry_remaining_datys, permit_days (national),
 *                        state_permit_remaining_datys
 *           user_subscribed : expiry_days
 * WHY   : The values are already correct at insert time (computed as date - today),
 *         so day-to-day we just tick them down by 1. Decrementing on the 9 AM cron
 *         means the value changes exactly when alerts are evaluated (no CURRENT_DATE
 *         / UTC-midnight timezone mismatch).
 * HOW   : The `last_decremented_on` guard makes this IDEMPOTENT — only rows not yet
 *         decremented TODAY are touched, so a server restart or a manual re-run the
 *         same day can't double-decrement. A row inserted today carries
 *         last_decremented_on = CURRENT_DATE (column default), so it is skipped
 *         until tomorrow (its value is already right for today). NULL remaining-days
 *         stay NULL (NULL - 1 = NULL) — documents without a date are untouched.
 * WHERE : Called once per day from the daily scheduler (scheduleDailyJobs → dailyTask).
 * BENEFIT: Cheap, drift-free daily countdown that feeds the document/subscription
 *         expiry alert thresholds.
 *
 * FAIL-SAFE: never throws — a failure here is logged and swallowed so it can't
 *         abort the other jobs running in the same daily task.
 *
 * @param {import('pg').Pool} [pool]  optional; falls back to the shared pool.
 * @returns {Promise<{rcUpdated:number, subUpdated:number, ok:boolean}>}
 */
const updateRemainingDays = async (pool = connectDB()) => {
  try {
    // 1) rc_details — decrement every document's remaining-days (once/day).
    const rc = await pool.query(`
      UPDATE rc_details SET
        rc_expiry_remaining_datys        = rc_expiry_remaining_datys - 1,
        insurance_expiry_remaining_datys = insurance_expiry_remaining_datys - 1,
        pucc_expiry_remaining_datys      = pucc_expiry_remaining_datys - 1,
        permit_days                      = permit_days - 1,
        state_permit_remaining_datys     = state_permit_remaining_datys - 1,
        last_decremented_on              = CURRENT_DATE
      WHERE COALESCE(last_decremented_on, DATE '2000-01-01') < CURRENT_DATE;
    `);

    // 2) user_subscribed — decrement subscription expiry_days (once/day).
    const sub = await pool.query(`
      UPDATE user_subscribed SET
        expiry_days         = expiry_days - 1,
        last_decremented_on = CURRENT_DATE
      WHERE COALESCE(last_decremented_on, DATE '2000-01-01') < CURRENT_DATE;
    `);

    console.log(
      `remaining-days decremented: rc_details ${rc.rowCount} row(s), user_subscribed ${sub.rowCount} row(s)`,
    );
    return { rcUpdated: rc.rowCount, subUpdated: sub.rowCount, ok: true };
  } catch (err) {
    // Fire-and-forget: log only, never throw — must not break sibling cron jobs.
    console.error("updateRemainingDays failed:", err.message);
    return { rcUpdated: 0, subUpdated: 0, ok: false };
  }
};

module.exports = updateRemainingDays;
