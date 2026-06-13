const { connectDB } = require("../../database/connectDB");

const pool = connectDB();

/**
 * Dashboard overview for the redesigned admin home — shapes real platform data
 * into the "Modern SaaS Professional" sections:
 *   • Metric grid with period-over-period trend badges (last 7d vs prior 7d)
 *   • 7-day activity (dual series: new users vs captured payments)
 *   • Growth & Retention progress cards (benchmark vs current)
 *   • Plan-performance table
 *
 * Read-only. Every figure is derived from existing tables; nothing is fabricated.
 */
const q = async (sql) => (await pool.query(sql)).rows;

const pct = (cur, prev) => {
  const c = Number(cur) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};
const share = (a, b) => {
  const total = (Number(a) || 0) + (Number(b) || 0);
  return total === 0 ? 0 : Math.round((Number(a) / total) * 100);
};

const getDashboardOverview = async () => {
  try {
    const [users7, subs7, rev7, msg7, activity, users30, subsAgg, plans] =
      await Promise.all([
        q(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= now()-interval '7 days')::int AS cur,
            COUNT(*) FILTER (WHERE created_at >= now()-interval '14 days'
                              AND created_at <  now()-interval '7 days')::int AS prev
          FROM users;`),
        q(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= now()-interval '7 days')::int AS cur,
            COUNT(*) FILTER (WHERE created_at >= now()-interval '14 days'
                              AND created_at <  now()-interval '7 days')::int AS prev
          FROM user_subscribed;`),
        q(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE created_at >= now()-interval '7 days'),0)::bigint AS cur,
            COALESCE(SUM(amount) FILTER (WHERE created_at >= now()-interval '14 days'
                              AND created_at <  now()-interval '7 days'),0)::bigint AS prev
          FROM payments WHERE captured = true;`),
        q(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= now()-interval '7 days')::int AS cur,
            COUNT(*) FILTER (WHERE created_at >= now()-interval '14 days'
                              AND created_at <  now()-interval '7 days')::int AS prev
          FROM message_logs WHERE is_sent = true;`),
        q(`
          SELECT to_char(d, 'Dy') AS dow,
                 COALESCE(u.cnt, 0)::int AS users,
                 COALESCE(p.cnt, 0)::int AS payments
            FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
            LEFT JOIN (
              SELECT date_trunc('day', created_at)::date dd, COUNT(*) cnt
                FROM users WHERE created_at >= CURRENT_DATE - 6 GROUP BY 1
            ) u ON u.dd = d::date
            LEFT JOIN (
              SELECT date_trunc('day', created_at)::date dd, COUNT(*) cnt
                FROM payments WHERE captured = true AND created_at >= CURRENT_DATE - 6 GROUP BY 1
            ) p ON p.dd = d::date
           ORDER BY d;`),
        q(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= now()-interval '30 days')::int AS cur,
            COUNT(*) FILTER (WHERE created_at >= now()-interval '60 days'
                              AND created_at <  now()-interval '30 days')::int AS prev
          FROM users;`),
        q(`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE is_active)::int AS active,
                 COUNT(*) FILTER (
                   WHERE fk_subscription_plans IN
                     (SELECT id FROM subscription_plans WHERE COALESCE(is_trial,false) = false)
                 )::int AS paid
          FROM user_subscribed;`),
        q(`
          SELECT COALESCE(sp.plan_name, 'Unknown') AS plan,
                 COALESCE(sp.price, 0)::numeric AS price,
                 COUNT(us.id)::int AS subscribers,
                 COUNT(us.id) FILTER (WHERE us.is_active)::int AS active
            FROM subscription_plans sp
            LEFT JOIN user_subscribed us ON us.fk_subscription_plans = sp.id
           GROUP BY sp.plan_name, sp.price
           ORDER BY subscribers DESC NULLS LAST LIMIT 6;`),
      ]);

    const u = users7[0] || {};
    const s = subs7[0] || {};
    const r = rev7[0] || {};
    const m = msg7[0] || {};
    const g = users30[0] || {};
    const agg = subsAgg[0] || {};

    const metric = (key, label, cur, prev, isCurrency = false) => ({
      key,
      label,
      value: isCurrency ? Number(cur || 0) / 100 : Number(cur || 0),
      is_currency: isCurrency,
      delta_pct: pct(cur, prev),
      trend: Number(cur || 0) >= Number(prev || 0) ? "up" : "down",
    });

    const growthCurrent = share(g.cur, g.prev); // last-30d share of the two periods
    const retentionPct =
      agg.total > 0 ? Math.round((agg.active / agg.total) * 100) : 0;
    const paidPct =
      agg.total > 0 ? Math.round((agg.paid / agg.total) * 100) : 0;

    return {
      statuscode: 200,
      successstatus: true,
      message: "Dashboard overview fetched successfully",
      data: {
        period: "Last 7 days",
        metrics: [
          metric("users", "New users", u.cur, u.prev),
          metric("revenue", "Revenue captured", r.cur, r.prev, true),
          metric("subscriptions", "New subscriptions", s.cur, s.prev),
          metric("messages", "Messages sent", m.cur, m.prev),
        ],
        activity: activity.map((a) => ({
          dow: a.dow.trim(),
          users: a.users,
          payments: a.payments,
        })),
        growth: {
          value: Number(g.cur || 0),
          current_pct: growthCurrent,
          benchmark_pct: 100 - growthCurrent,
          status: Number(g.cur || 0) >= Number(g.prev || 0) ? "Healthy" : "Stable",
        },
        retention: {
          value_pct: retentionPct,
          current_pct: retentionPct,
          benchmark_pct: paidPct,
          status: retentionPct >= 60 ? "Healthy" : "Stable",
        },
        plan_performance: plans.map((p) => ({
          plan: p.plan,
          price: Number(p.price || 0),
          subscribers: p.subscribers,
          active: p.active,
          active_rate:
            p.subscribers > 0 ? Math.round((p.active / p.subscribers) * 100) : 0,
        })),
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching dashboard overview. Error: ${err.message}`,
    };
  }
};

module.exports = getDashboardOverview;
