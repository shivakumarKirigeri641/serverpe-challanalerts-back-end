const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Refreshes the cached "remaining days" columns on rc_details so they stay
 * current over time (the values are computed at insert, but a stored value is
 * a snapshot — this daily job re-derives them against today's date).
 *
 *   rc_expiry_remaining_datys        = rc_expiry_date         - CURRENT_DATE
 *   insurance_expiry_remaining_datys = vehicle_insurance_upto - CURRENT_DATE
 *   pucc_expiry_remaining_datys      = pucc_upto              - CURRENT_DATE  (NULL when pucc_upto is NULL)
 *
 * Only rows whose computed value has actually drifted are updated, so the daily
 * write stays cheap. Fire-and-forget; errors are swallowed by the caller.
 */
const recalcRcExpiryDays = async () => {
  try {
    const result = await pool.query(`
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
      `rc_details expiry-days recalculated: ${result.rowCount} row(s) updated`,
    );
    return result.rowCount;
  } catch (err) {
    console.error("recalcRcExpiryDays failed:", err.message);
    throw err;
  }
};

module.exports = recalcRcExpiryDays;
