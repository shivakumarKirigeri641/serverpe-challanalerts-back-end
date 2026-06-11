const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Daily users.feedback_days counter tick.
 *
 * Feedback is account-level, so the counter lives on the users table (one per
 * account, not per vehicle). Advances feedback_days by 1 each day, wrapping
 * back to 0 on reaching 28 (cycles 0 → 27 → 0 on a 28-day period). The feedback
 * WhatsApp (Part 3 of doAlertJob) fires on the day the counter is 0.
 *
 * Requires the column to exist first:
 *   ALTER TABLE users ADD COLUMN feedback_days integer DEFAULT 0;
 *
 * NOT idempotent (running counter) — fire exactly once per day.
 * Fire-and-forget; the caller swallows errors.
 */
const incrementFeedbackDays = async () => {
  try {
    const res = await pool.query(`
      UPDATE users SET
        feedback_days = (COALESCE(feedback_days, 0) + 1) % 28;
    `);
    console.log(
      `users feedback_days incremented: ${res.rowCount} row(s) updated`,
    );
    return { feedbackDaysUpdated: res.rowCount };
  } catch (err) {
    console.error("incrementFeedbackDays failed:", err.message);
    throw err;
  }
};

module.exports = incrementFeedbackDays;
