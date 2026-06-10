const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Daily rc_details maintenance:
 *
 *  1) Refreshes the cached "remaining days" columns against today's date
 *     (idempotent — safe to run any number of times per day):
 *       rc_expiry_remaining_datys        = rc_expiry_date         - CURRENT_DATE
 *       insurance_expiry_remaining_datys = vehicle_insurance_upto - CURRENT_DATE
 *       pucc_expiry_remaining_datys      = pucc_upto              - CURRENT_DATE
 *       permit_days                      = national_permit_upto   - CURRENT_DATE
 *     (each is NULL when its source date is NULL).
 *
 *  2) Refreshes user_subscribed.expiry_days from expires_on.
 *
 * Fire-and-forget; the caller swallows errors.
 */

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
               ELSE (pucc_upto - CURRENT_DATE) END,
        permit_days =
          CASE WHEN national_permit_upto IS NULL THEN NULL
               ELSE (national_permit_upto - CURRENT_DATE) END
      WHERE
        rc_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN rc_expiry_date IS NULL THEN NULL
                ELSE (rc_expiry_date - CURRENT_DATE) END)
        OR insurance_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN vehicle_insurance_upto IS NULL THEN NULL
                ELSE (vehicle_insurance_upto - CURRENT_DATE) END)
        OR pucc_expiry_remaining_datys IS DISTINCT FROM
          (CASE WHEN pucc_upto IS NULL THEN NULL
                ELSE (pucc_upto - CURRENT_DATE) END)
        OR permit_days IS DISTINCT FROM
          (CASE WHEN national_permit_upto IS NULL THEN NULL
                ELSE (national_permit_upto - CURRENT_DATE) END);
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

    return {
      expiryUpdated: days.rowCount,
      subExpiryUpdated: subDays.rowCount,
    };
  } catch (err) {
    console.error("recalcRcExpiryDays failed:", err.message);
    throw err;
  }
};

module.exports = recalcRcExpiryDays;
