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
      externalToday,
      externalByDay,
      externalByName,
      msgByChannel,
      msgByKind,
      msgCostByDay,
      subsByType,
      walletRow,
      smsWalletRow,
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
      // ── Cost & operations: external API calls (RC billed ~₹2.9) ──────────
      q(`
        SELECT COUNT(*)::int AS calls,
               ROUND(SUM(CASE WHEN api_name='RC' THEN 2.9 ELSE 0 END)::numeric, 2) AS cost
          FROM external_api_calls WHERE call_date = CURRENT_DATE;`),
      q(`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS calls,
               ROUND(SUM(CASE WHEN api_name='RC' THEN 2.9 ELSE 0 END)::numeric, 2) AS cost
          FROM external_api_calls
         WHERE created_at >= now() - interval '14 days'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT api_name,
               COUNT(*)::int AS calls,
               ROUND(SUM(CASE WHEN api_name='RC' THEN 2.9 ELSE 0 END)::numeric, 2) AS cost
          FROM external_api_calls
         GROUP BY 1 ORDER BY calls DESC;`),
      // ── Notification spend (WhatsApp/SMS) from message_logs.cost ─────────
      q(`
        SELECT message_type AS channel,
               COUNT(*) FILTER (WHERE is_sent)::int AS sent,
               COUNT(*) FILTER (WHERE is_failed)::int AS failed,
               ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS cost
          FROM message_logs GROUP BY 1 ORDER BY cost DESC;`),
      q(`
        SELECT COALESCE(comments, '(other)') AS kind,
               COUNT(*)::int AS count,
               ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS cost
          FROM message_logs GROUP BY 1 ORDER BY count DESC LIMIT 12;`),
      q(`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               ROUND(COALESCE(SUM(cost), 0)::numeric, 2) AS cost
          FROM message_logs WHERE created_at >= now() - interval '14 days'
         GROUP BY 1 ORDER BY 1;`),
      q(`
        SELECT CASE WHEN sp.is_trial THEN 'Trial' ELSE 'Paid' END AS type,
               COUNT(*)::int AS count
          FROM user_subscribed us
          JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
         GROUP BY 1 ORDER BY count DESC;`),
      // Provider wallet (recharged by admin, deducted per external call).
      q(`SELECT balance, per_call_cost FROM external_api_wallet WHERE id = 1;`),
      // SMS wallet (recharged by admin, deducted per SMS sent).
      q(`SELECT balance, per_sms_cost FROM sms_wallet WHERE id = 1;`),
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
        // Cost & operations (admin-only spend tracking).
        external_api: {
          wallet_balance: Number(walletRow[0]?.balance || 0),
          per_call_cost: Number(walletRow[0]?.per_call_cost || 0),
          today: {
            calls: externalToday[0]?.calls || 0,
            cost: Number(externalToday[0]?.cost || 0),
          },
          by_day: externalByDay.map((r) => ({
            day: r.day,
            calls: r.calls,
            cost: Number(r.cost || 0),
          })),
          by_name: externalByName.map((r) => ({
            api_name: r.api_name,
            calls: r.calls,
            cost: Number(r.cost || 0),
          })),
        },
        notification: {
          sms_wallet_balance: Number(smsWalletRow[0]?.balance || 0),
          per_sms_cost: Number(smsWalletRow[0]?.per_sms_cost || 0),
          total_cost: msgByChannel.reduce((s, r) => s + Number(r.cost || 0), 0),
          by_channel: msgByChannel.map((r) => ({
            channel: r.channel,
            sent: r.sent,
            failed: r.failed,
            cost: Number(r.cost || 0),
          })),
          by_kind: msgByKind.map((r) => ({
            kind: r.kind,
            count: r.count,
            cost: Number(r.cost || 0),
          })),
          cost_by_day: msgCostByDay.map((r) => ({
            day: r.day,
            cost: Number(r.cost || 0),
          })),
        },
        subscriptions_by_type: subsByType,
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
