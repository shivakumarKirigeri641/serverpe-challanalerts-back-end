const { sendWhatsApp } = require("../../comms/sendWhatsApp");
const { costFor } = require("../../utils/messageCost");

/**
 * Daily SUBSCRIPTION-expiry alerting.
 *
 * WHAT  : Finds subscribers whose current subscription's `expiry_days` lands on a
 *         configured threshold and segregates them into two groups:
 *           • within subscription (positive days: 45/30/15/7/3/1) → "expiring soon"
 *           • subscription over    (negative days: -1/-7/-15)      → "expired / renew"
 *         then triggers the matching WhatsApp message for each.
 * WHY   : Thresholds live in the DB table `expiry_days_mapping` (days + is_active),
 *         so they can be tuned/disabled by an admin with NO code change. The sign of
 *         the value decides the message type (>=0 expiring, <0 expired).
 * WHERE : Called once per day from the daily scheduler (scheduleDailyJobs → dailyTask),
 *         after updateRemainingDays has decremented expiry_days for the day.
 * HOW   : expiry_days is matched EXACTLY (= ANY(active days)). Dedup is per
 *         (user, phase) per day via `message_logs` (same mechanism as the document
 *         job), so running the job many times a day (restart / fast test cron)
 *         never re-spams the same threshold. sendWhatsApp never throws (SMS
 *         fallback), and this function swallows its own errors → can't break
 *         sibling cron jobs.
 *
 * ⚠️ TEMPLATES ARE PLACEHOLDERS — replace SUB_EXPIRING_TPL / SUB_EXPIRED_TPL with the
 *    approved WhatsApp template names and adjust each params() order.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{expiring:number, expired:number, ok:boolean}>}
 */

// ── PLACEHOLDER WhatsApp templates + param builders (fill in real values). ──
const SUB_EXPIRING_TPL = "amv_subscription_expiring_v1"; // days = remaining
const SUB_EXPIRED_TPL = "amv_subscription_expired_v1"; // days = since expiry
const expiringParams = (s, expiry_date, days) => [
  s.user_name,
  expiry_date,
  String(days),
];
const expiredParams = (s, expiry_date, daysSince) => [
  s.user_name,
  expiry_date,
  String(daysSince),
];

/** Format a DB date/timestamp to "YYYY-MM-DD". */
const toDateStr = (d) => {
  if (!d) return "N/A";
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? "N/A" : dt.toISOString().split("T")[0];
};

/* Dedup via message_logs: message_type is the CHANNEL (constrained to
   SMS/WHATSAPP/EMAIL); the semantic alert key (SUB_EXPIRING/SUB_EXPIRED) lives in
   `comments`, which we dedup on. Subscription alerts are per-account, so
   fk_rc_details is NULL and the dedup is keyed on fk_users. */
const CHANNEL = "WHATSAPP";

/** Already sent this subscription alert (user + phase) today? */
const alreadyAlertedToday = async (pool, userId, alertKey) => {
  const r = await pool.query(
    `select 1 from message_logs
      where fk_users = $1 and message_type = $2 and comments = $3
        and created_at::date = CURRENT_DATE
      limit 1`,
    [userId, CHANNEL, alertKey],
  );
  return r.rows.length > 0;
};

/** Record the send (also serves as the once-per-day dedup marker). */
const logMessage = async (pool, userId, alertKey, content, ok) => {
  await pool.query(
    `insert into message_logs
       (fk_users, fk_rc_details, message_type, message_content, is_sent, is_failed, comments, cost)
     values ($1, NULL, $2, $3, $4, $5, $6, $7)`,
    [userId, CHANNEL, content, ok, !ok, alertKey, costFor(CHANNEL, ok)],
  );
};

const handleAlertingSubscribers = async (pool) => {
  try {
    // 1) Active threshold days from the config table (admin-managed).
    const map = await pool.query(
      `select days from expiry_days_mapping where is_active = true`,
    );
    const days = map.rows.map((r) => Number(r.days));
    if (days.length === 0) {
      console.log("[sub-alerts] no active thresholds in expiry_days_mapping");
      return { expiring: 0, expired: 0, ok: true };
    }

    // 2) Subscribers whose CURRENT (active) subscription's expiry_days hits a
    //    threshold. is_active=true picks the live subscription; an expired-but-
    //    not-renewed one still has is_active=true with expiry_days < 0.
    const subs = await pool.query(
      `select u.id   as user_id,
              u.user_name,
              u.mobile_number,
              us.id  as sub_id,
              us.expiry_days,
              us.expires_on
         from user_subscribed us
         join users u on u.id = us.fk_users
        where coalesce(u.is_active, true) = true
          and coalesce(us.is_active, true) = true
          and us.expiry_days = any($1::int[])`,
      [days],
    );

    // 3) Segregate by sign + trigger the matching WhatsApp (placeholder).
    let expiring = 0;
    let expired = 0;
    for (const s of subs.rows) {
      const expiry_date = toDateStr(s.expires_on);
      const isExpired = s.expiry_days < 0;
      const alertKey = isExpired ? "SUB_EXPIRED" : "SUB_EXPIRING";
      try {
        // Once-per-day dedup (restart / fast test cron safe).
        if (await alreadyAlertedToday(pool, s.user_id, alertKey)) continue;

        const template = isExpired ? SUB_EXPIRED_TPL : SUB_EXPIRING_TPL;
        const params = isExpired
          ? expiredParams(s, expiry_date, Math.abs(s.expiry_days)) // days since expiry
          : expiringParams(s, expiry_date, s.expiry_days); // days remaining

        const res = await sendWhatsApp({
          mobile_number: s.mobile_number,
          template,
          params,
        });
        await logMessage(
          pool,
          s.user_id,
          alertKey,
          JSON.stringify({ template, params }),
          !!res.ok,
        );

        if (isExpired) {
          expired += 1;
          console.log(
            `[sub-alerts] expired → ${s.mobile_number} (+${Math.abs(s.expiry_days)}d over)`,
          );
        } else {
          expiring += 1;
          console.log(
            `[sub-alerts] expiring → ${s.mobile_number} (${s.expiry_days}d left)`,
          );
        }
      } catch (err) {
        // Per-user guard so one bad send doesn't skip the rest.
        console.error(
          `[sub-alerts] send failed for ${s.mobile_number}:`,
          err.message,
        );
      }
    }

    console.log(
      `[sub-alerts] done: ${expiring} expiring, ${expired} expired (of ${subs.rows.length} matched)`,
    );
    return { expiring, expired, ok: true };
  } catch (err) {
    // Fire-and-forget: never throw — must not break sibling cron jobs.
    console.error("handleAlertingSubscribers failed:", err.message);
    return { expiring: 0, expired: 0, ok: false };
  }
};

module.exports = handleAlertingSubscribers;
