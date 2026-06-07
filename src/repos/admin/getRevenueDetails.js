const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Captured-revenue breakdown for the admin dashboard.
 *
 * IMPORTANT: payments.amount (paise) is GST-INCLUSIVE — the plan price already
 * contains GST. So the tax is back-calculated from the gross:
 *
 *   gst      = gross * rate / (100 + rate)
 *   taxable  = gross * 100  / (100 + rate)      (revenue WITHOUT GST)
 *
 * Net received also subtracts any refunds (amount_refunded).
 */
const getRevenueDetails = async () => {
  try {
    const result = await pool.query(`
      WITH p AS (
        SELECT
          COALESCE(SUM(amount), 0)::bigint           AS gross_paise,
          COALESCE(SUM(amount_refunded), 0)::bigint  AS refunded_paise,
          COUNT(*)::int                              AS captured_count
        FROM payments
        WHERE captured = true
      ),
      g AS (
        SELECT COALESCE(
          (SELECT gst_percent FROM gst_percents
            WHERE is_active = true ORDER BY id LIMIT 1), 0
        )::numeric AS gst_percent
      )
      SELECT
        g.gst_percent,
        p.captured_count,
        p.gross_paise,
        p.refunded_paise,
        (p.gross_paise - p.refunded_paise)::bigint AS net_received_paise,
        ROUND(p.gross_paise * g.gst_percent / (100 + g.gst_percent))::bigint AS gst_paise,
        ROUND(p.gross_paise * 100.0 / (100 + g.gst_percent))::bigint         AS taxable_paise
      FROM p, g;
    `);

    const r = result.rows[0] || {};
    const toRupees = (paise) => Number(paise || 0) / 100;

    return {
      statuscode: 200,
      successstatus: true,
      message: "Revenue details fetched successfully",
      data: {
        gst_percent: Number(r.gst_percent || 0),
        captured_count: r.captured_count || 0,
        currency: "INR",
        // paise (raw integers)
        gross_paise: r.gross_paise || "0",
        gst_paise: r.gst_paise || "0",
        taxable_paise: r.taxable_paise || "0",
        refunded_paise: r.refunded_paise || "0",
        net_received_paise: r.net_received_paise || "0",
        // rupees (display)
        total_with_gst: toRupees(r.gross_paise), // total collected (incl. GST)
        gst_amount: toRupees(r.gst_paise), // GST portion
        total_without_gst: toRupees(r.taxable_paise), // taxable value (excl. GST)
        refunded: toRupees(r.refunded_paise),
        net_received: toRupees(r.net_received_paise), // gross - refunds
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching revenue details. Error: ${err.message}`,
    };
  }
};

module.exports = getRevenueDetails;
