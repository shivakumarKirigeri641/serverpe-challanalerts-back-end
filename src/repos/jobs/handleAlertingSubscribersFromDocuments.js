const { sendWhatsApp } = require("../../comms/sendWhatsApp");

/**
 * Daily DOCUMENT-expiry alerting (per vehicle, per document).
 *
 * WHAT  : For every vehicle of a WITHIN-subscription user, checks each document's
 *         cached remaining-days against the configured thresholds and, on a match,
 *         sends the matching WhatsApp:
 *           • positive days (45/30/15/7/3/1) → "expiring soon" template
 *           • negative days (-1/-7/-15)       → "expired" template
 *         Documents covered: RC, Insurance, PUCC, State permit, National permit.
 *         A document whose date is absent has a NULL remaining-days, so it simply
 *         never matches a threshold (the "if not null" is handled automatically).
 * WHY   : Same admin-managed `expiry_days_mapping` table as the subscription job —
 *         the sign of the value picks expired vs expiring. Only within-subscription
 *         users are alerted (document monitoring is the paid service).
 * WHERE : Daily scheduler (scheduleDailyJobs → dailyTask), AFTER updateRemainingDays.
 * HOW   : Dedup is per (vehicle, document, phase) per day via `message_logs`, so a
 *         vehicle can still get RC + insurance alerts on the same day, but never the
 *         same one twice (restart / fast test cron safe). sendWhatsApp never throws;
 *         this function swallows its own errors so it can't break sibling cron jobs.
 *
 * ⚠️ TEMPLATES ARE PLACEHOLDERS — set each document's expiringTpl / expiredTpl to the
 *    approved WhatsApp template names and adjust params() order below.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{expiring:number, expired:number, ok:boolean}>}
 */

/* Per-document config. `remainingField` = cached remaining-days column;
   `dateField` = the source date (shown in the message). Separate templates for
   nearing-expiry (positive) vs already-expired (negative). */
const DOCUMENTS = [
  {
    key: "RC",
    remainingField: "rc_expiry_remaining_datys",
    dateField: "rc_expiry_date",
    expiringTpl: "PLACEHOLDER_rc_expiring",
    expiredTpl: "PLACEHOLDER_rc_expired",
  },
  {
    key: "INSURANCE",
    remainingField: "insurance_expiry_remaining_datys",
    dateField: "vehicle_insurance_upto",
    expiringTpl: "PLACEHOLDER_insurance_expiring",
    expiredTpl: "PLACEHOLDER_insurance_expired",
  },
  {
    key: "PUCC",
    remainingField: "pucc_expiry_remaining_datys",
    dateField: "pucc_upto",
    expiringTpl: "PLACEHOLDER_pucc_expiring",
    expiredTpl: "PLACEHOLDER_pucc_expired",
  },
  {
    key: "STATE_PERMIT",
    remainingField: "state_permit_remaining_datys",
    dateField: "permit_valid_upto",
    expiringTpl: "PLACEHOLDER_state_permit_expiring",
    expiredTpl: "PLACEHOLDER_state_permit_expired",
  },
  {
    key: "NATIONAL_PERMIT",
    remainingField: "permit_days",
    dateField: "national_permit_upto",
    expiringTpl: "PLACEHOLDER_permit_expiring",
    expiredTpl: "PLACEHOLDER_permit_expired",
  },
];

/* WhatsApp body params — same order for both phases (fill to match templates). */
const buildParams = (v, doc, expiry_date, days) => [
  v.user_name,
  v.reg_no,
  expiry_date,
  String(days),
];

/** Format a DB date/timestamp to "YYYY-MM-DD". */
const toDateStr = (d) => {
  if (!d) return "N/A";
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? "N/A" : dt.toISOString().split("T")[0];
};

/* message_logs.message_type is the CHANNEL (constrained to SMS/WHATSAPP/EMAIL).
   The semantic alert key (e.g. "DOC_RC_EXPIRING") is stored in `comments`, which
   is what we dedup on. */
const CHANNEL = "WHATSAPP";

/** Already sent this exact alert (vehicle + document + phase) today? */
const alreadyAlertedToday = async (pool, rcId, alertKey) => {
  const r = await pool.query(
    `select 1 from message_logs
      where fk_rc_details = $1 and message_type = $2 and comments = $3
        and created_at::date = CURRENT_DATE
      limit 1`,
    [rcId, CHANNEL, alertKey],
  );
  return r.rows.length > 0;
};

/** Record the send (also serves as the once-per-day dedup marker). */
const logMessage = async (pool, userId, rcId, alertKey, content, ok) => {
  await pool.query(
    `insert into message_logs
       (fk_users, fk_rc_details, message_type, message_content, is_sent, is_failed, comments)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, rcId, CHANNEL, content, ok, !ok, alertKey],
  );
};

const handleAlertingSubscribersFromDocuments = async (pool) => {
  try {
    // 1) Active threshold days (admin-managed; shared with the subscription job).
    const map = await pool.query(
      `select days from expiry_days_mapping where is_active = true`,
    );
    const days = map.rows.map((r) => Number(r.days));
    if (days.length === 0) {
      console.log("[doc-alerts] no active thresholds in expiry_days_mapping");
      return { expiring: 0, expired: 0, ok: true };
    }
    const thresholds = new Set(days);

    // 2) Active vehicles of WITHIN-subscription users (expiry_days >= 0).
    const vehicles = await pool.query(
      `select rc.id as rc_id, rc.fk_users as user_id, rc.reg_no,
              u.user_name, u.mobile_number,
              rc.rc_expiry_remaining_datys, rc.rc_expiry_date,
              rc.insurance_expiry_remaining_datys, rc.vehicle_insurance_upto,
              rc.pucc_expiry_remaining_datys, rc.pucc_upto,
              rc.state_permit_remaining_datys, rc.permit_valid_upto,
              rc.permit_days, rc.national_permit_upto
         from rc_details rc
         join users u on u.id = rc.fk_users
        where coalesce(rc.is_active, true) = true
          and coalesce(u.is_active, true) = true
          and exists (
            select 1 from user_subscribed us
             where us.fk_users = u.id
               and coalesce(us.is_active, true) = true
               and us.expiry_days >= 0
          )`,
    );

    // 3) Per vehicle, per document → match threshold, dedup, send.
    let expiring = 0;
    let expired = 0;
    for (const v of vehicles.rows) {
      for (const doc of DOCUMENTS) {
        const remaining = v[doc.remainingField];
        // NULL (absent document) or not on a threshold → skip.
        if (remaining == null || !thresholds.has(remaining)) continue;

        const isExpired = remaining < 0;
        const phase = isExpired ? "EXPIRED" : "EXPIRING";
        const alertKey = `DOC_${doc.key}_${phase}`;

        try {
          if (await alreadyAlertedToday(pool, v.rc_id, alertKey)) continue;

          const template = isExpired ? doc.expiredTpl : doc.expiringTpl;
          const expiry_date = toDateStr(v[doc.dateField]);
          const daysParam = isExpired ? Math.abs(remaining) : remaining;
          const params = buildParams(v, doc, expiry_date, daysParam);

          const res = await sendWhatsApp({
            mobile_number: v.mobile_number,
            template,
            params,
          });
          await logMessage(
            pool,
            v.user_id,
            v.rc_id,
            alertKey,
            JSON.stringify({ template, params }),
            !!res.ok,
          );

          if (isExpired) expired += 1;
          else expiring += 1;
          console.log(
            `[doc-alerts] ${doc.key} ${phase} → ${v.mobile_number} ${v.reg_no} (${remaining}d)`,
          );
        } catch (err) {
          // Per-document guard so one bad send doesn't skip the rest.
          console.error(
            `[doc-alerts] ${doc.key} send failed for ${v.reg_no}:`,
            err.message,
          );
        }
      }
    }

    console.log(
      `[doc-alerts] done: ${expiring} expiring, ${expired} expired across ${vehicles.rows.length} vehicle(s)`,
    );
    return { expiring, expired, ok: true };
  } catch (err) {
    // Fire-and-forget: never throw — must not break sibling cron jobs.
    console.error("handleAlertingSubscribersFromDocuments failed:", err.message);
    return { expiring: 0, expired: 0, ok: false };
  }
};

module.exports = handleAlertingSubscribersFromDocuments;
