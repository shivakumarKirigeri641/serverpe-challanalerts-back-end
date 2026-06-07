const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Daily rc_details maintenance:
 *
 *  1) Refreshes the cached "remaining days" columns against today's date
 *     (idempotent — safe to run any number of times per day):
 *       rc_expiry_remaining_datys        = rc_expiry_date         - CURRENT_DATE
 *       insurance_expiry_remaining_datys = vehicle_insurance_upto - CURRENT_DATE
 *       pucc_expiry_remaining_datys      = pucc_upto              - CURRENT_DATE  (NULL when pucc_upto is NULL)
 *
 *  2) Increments challan_days by 1 each calendar day, cycling 0→15 and back to
 *     0 once it would hit 16:  challan_days = (challan_days + 1) % 16.
 *     This is NOT idempotent, so it is guarded by a per-day claim in job_state
 *     — multiple boots/runs on the same day increment it at most once.
 *
 * Fire-and-forget; the caller swallows errors.
 */

const CHALLAN_DAYS_CYCLE = 16; // values 0..15, then wraps to 0

const recalcRcExpiryDays = async () => {
  try {
    /* 1) Idempotent remaining-days refresh — only rows that drifted. */
    const days = await pool.query(`
      UPDATE rc_details SET
        rc_expiry_remaining_datys =
          CASE WHEN rc_expiry_date IS NULL THEN NULL
               ELSE (rc_expiry_date - CURRENT_DATE) END,
        insurance_expiry_remaining_datys =
          CASE WHEN vehicle_insurance_upto IS NULL THEN NULL
               ELSE (vehicle_insurance_upto - CURRENT_DATE) END,
        pucc_expiry_remaining_datys =
          CASE WHEN pucc_upto IS NULL THEN NULL
               ELSE (pucc_upto - CURRENT_DATE) END
      WHERE
        rc_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN rc_expiry_date IS NULL THEN NULL
                ELSE (rc_expiry_date - CURRENT_DATE) END)
        OR insurance_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN vehicle_insurance_upto IS NULL THEN NULL
                ELSE (vehicle_insurance_upto - CURRENT_DATE) END)
        OR pucc_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN pucc_upto IS NULL THEN NULL
                ELSE (pucc_upto - CURRENT_DATE) END);
    `);
    console.log(
      `rc_details expiry-days recalculated: ${days.rowCount} row(s) updated`,
    );

    /* 1b) user_subscribed.expiry_days = days remaining until expires_on.
          Idempotent (re-derived from today's date), so it "auto-decrements"
          as days pass and is safe to run multiple times a day. */
    const subDays = await pool.query(`
      UPDATE user_subscribed SET
        expiry_days =
          CASE WHEN expires_on IS NULL THEN NULL
               ELSE (expires_on::date - CURRENT_DATE) END
      WHERE expiry_days IS DISTINCT FROM
        (CASE WHEN expires_on IS NULL THEN NULL
              ELSE (expires_on::date - CURRENT_DATE) END);
    `);
    console.log(
      `user_subscribed expiry-days recalculated: ${subDays.rowCount} row(s) updated`,
    );

    /* 2) Once-per-day challan_days increment, guarded by job_state so a restart
          on the same day doesn't increment it again. */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_state (
        name          text PRIMARY KEY,
        last_run_date date
      );
    `);

    // Atomically claim today's run: returns a row only if it hadn't run today.
    const claim = await pool.query(`
      INSERT INTO job_state (name, last_run_date)
      VALUES ('challan_days_increment', CURRENT_DATE)
      ON CONFLICT (name) DO UPDATE SET last_run_date = CURRENT_DATE
        WHERE job_state.last_run_date IS DISTINCT FROM CURRENT_DATE
      RETURNING name;
    `);

    if (claim.rowCount > 0) {
      const inc = await pool.query(
        `UPDATE rc_details
            SET challan_days = (COALESCE(challan_days, 0) + 1) % $1;`,
        [CHALLAN_DAYS_CYCLE],
      );
      console.log(
        `challan_days incremented (cycle 0-${CHALLAN_DAYS_CYCLE - 1}): ${inc.rowCount} row(s)`,
      );
    } else {
      console.log("challan_days already incremented today; skipping");
    }

    return {
      expiryUpdated: days.rowCount,
      subExpiryUpdated: subDays.rowCount,
      challanIncremented: claim.rowCount > 0,
    };
  } catch (err) {
    console.error("recalcRcExpiryDays failed:", err.message);
    throw err;
  }
};

module.exports = recalcRcExpiryDays;
