const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Aggregated counts + revenue for the admin dashboard landing page.
 * One round-trip using a single multi-CTE query.
 */
const getDashboardStats = async () => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users)                                      AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE is_active = true)               AS active_users,
        (SELECT COUNT(*)::int FROM rc_details)                                 AS total_vehicles,
        (SELECT COUNT(*)::int FROM challan_details)                            AS total_challans,
        (SELECT COUNT(*)::int FROM fastag_details)                            AS total_fastags,
        (SELECT COUNT(*)::int FROM user_subscribed WHERE is_active = true
            AND expires_on > now())                                           AS active_subscriptions,
        (SELECT COUNT(*)::int FROM contact_me WHERE is_resolved = false)       AS open_queries,
        (SELECT COUNT(*)::int FROM feedbacks)                                  AS total_feedbacks,
        (SELECT COUNT(*)::int FROM payments WHERE captured = true)             AS captured_payments,
        (SELECT COALESCE(SUM(amount), 0)::bigint FROM payments
            WHERE captured = true)                                            AS total_revenue_paise;
    `);

    return {
      statuscode: 200,
      successstatus: true,
      message: "Dashboard stats fetched successfully",
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching dashboard stats. Error: ${err.message}`,
    };
  }
};

module.exports = getDashboardStats;
