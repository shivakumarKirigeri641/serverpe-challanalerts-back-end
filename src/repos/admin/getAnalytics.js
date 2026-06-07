const { connectDB } = require("../../database/connectDB");
const getDashboardStats = require("./getDashboardStats");
const getRevenueDetails = require("./getRevenueDetails");

const pool = connectDB();

/**
 * Power-BI style analytics for the admin console: KPI headline numbers plus a
 * set of time-series / distribution datasets the frontend renders as charts.
 *
 * All grouping/bucketing happens in SQL (to_char on date_trunc) so rows come
 * back as plain strings ready to plot. Every query is best-effort and runs in
 * parallel.
 */
const q = async (sql) => {
  const r = await pool.query(sql);
  return r.rows;
};

const getAnalytics = async () => {
  try {
    const [
      stats,
      revenue,
      usersByMonth,
      subsByMonth,
      revenueByMonth,
      invoicesByMonth,
      paymentsByStatus,
      planDistribution,
      topStates,
      loginsByDay,
      challansByStatus,
    ] = await Promise.all([
      getDashboardStats(),
      getRevenueDetails(),
      q(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
          FROM users
         WHERE created_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE is_active = true)::int AS active
          FROM user_subscribed
         WHERE created_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS payments,
               COALESCE(SUM(amount), 0)::bigint AS gross_paise
          FROM payments
         WHERE captured = true AND created_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
          FROM invoices
         WHERE created_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT COALESCE(status, 'unknown') AS status,
               COUNT(*)::int AS count,
               COALESCE(SUM(amount), 0)::bigint AS amount_paise
          FROM payments
         GROUP BY 1 ORDER BY count DESC;`),
      q(`
        SELECT COALESCE(sp.plan_name, 'Unknown') AS plan_name,
               COUNT(*)::int AS subscriptions
          FROM user_subscribed us
          LEFT JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
         GROUP BY 1 ORDER BY subscriptions DESC;`),
      q(`
        SELECT COALESCE(su.state_union_name, 'Unknown') AS state,
               COUNT(*)::int AS users
          FROM users u
          LEFT JOIN states_unions su ON su.id = u.fk_states_unions
         GROUP BY 1 ORDER BY users DESC NULLS LAST LIMIT 10;`),
      q(`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS logins
          FROM api_logs
         WHERE endpoint ILIKE '%verify-otp%'
           AND created_at >= now() - interval '14 days'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT COALESCE(challan_status, 'unknown') AS status,
               COUNT(*)::int AS count,
               COALESCE(SUM(challan_amount), 0)::numeric AS amount
          FROM challan_details
         GROUP BY 1 ORDER BY count DESC;`),
    ]);

    return {
      statuscode: 200,
      successstatus: true,
      message: "Analytics fetched successfully",
      data: {
        kpis: stats.data || {},
        revenue: revenue.data || {},
        users_by_month: usersByMonth,
        subscriptions_by_month: subsByMonth,
        revenue_by_month: revenueByMonth.map((r) => ({
          month: r.month,
          payments: r.payments,
          gross: Number(r.gross_paise || 0) / 100,
        })),
        invoices_by_month: invoicesByMonth,
        payments_by_status: paymentsByStatus.map((r) => ({
          status: r.status,
          count: r.count,
          amount: Number(r.amount_paise || 0) / 100,
        })),
        plan_distribution: planDistribution,
        top_states: topStates,
        logins_by_day: loginsByDay,
        challans_by_status: challansByStatus.map((r) => ({
          status: r.status,
          count: r.count,
          amount: Number(r.amount || 0),
        })),
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching analytics. Error: ${err.message}`,
    };
  }
};

module.exports = getAnalytics;
