const { connectDB } = require("../../database/connectDB");
const {
  fetchVehicleExternalDetails,
} = require("../insertions/insertNewVehicle");
const getRCUpdateQuery = require("../../utils/getRCUpdateQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const { sendWhatsApp } = require("../../comms/sendWhatsApp");

const pool = connectDB();

/* Day thresholds (exact match) on the cached remaining-days columns. */
const SUBSCRIPTION_EXPIRING_DAYS = [30, 15, 7, 3, 1];
const DOCUMENT_EXPIRING_DAYS = [45, 30, 15, 7, 3, 1];
const DOCUMENT_EXPIRED_DAYS = [1, 7, 15]; // days AFTER expiry, then stop
const SUBSCRIPTION_EXPIRED_EVERY = 7; // re-nudge every 7 days after expiry

/* Subscription template names — final/approved. */
const TPL = {
  SUB_EXPIRED: "amv_trialsubexprd_v1",
  SUB_EXPIRING: "amv_trailsubs_expring_v1",
};

/* Challan-check alerts — PLACEHOLDERS. Replace each template name and tweak
   each params() builder. ctx exposes user_name, reg_no; `count` is the number
   of challans returned by the external API. */
const CHALLAN_ALERT = {
  found: {
    template: "PLACEHOLDER_challan_found", // TODO
    params: (ctx, count) => [ctx.user_name, ctx.reg_no, String(count)],
  },
  none: {
    template: "PLACEHOLDER_challan_none", // TODO
    params: (ctx) => [ctx.user_name, ctx.reg_no],
  },
};

/* Feedback nudge (once per account, ~every 28 days) — PLACEHOLDER. */
const FEEDBACK_ALERT = {
  template: "PLACEHOLDER_feedback", // TODO
  params: (ctx) => [ctx.user_name, ctx.reg_no],
};

/* Vehicle Document Health (VDH) report (per vehicle, ~every 28 days) —
   PLACEHOLDER. Replace template + params once you provide the report details. */
const VDH_ALERT = {
  template: "PLACEHOLDER_vdh_report", // TODO
  params: (ctx) => [ctx.user_name, ctx.reg_no],
};

/* Per-document config. Each document carries its OWN expiring/expired template
   and param builder — fill in the exact approved template name + parameter
   order for each. `remainingField` is the cached rc_details column the cadence
   is checked against.
   ── TODO(you): replace every PLACEHOLDER_* name and each params() array. */
const DOCUMENTS = [
  {
    key: "RC",
    remainingField: "rc_expiry_remaining_datys",
    expiringTpl: "PLACEHOLDER_rc_expiring",
    expiredTpl: "PLACEHOLDER_rc_expired",
    // ctx = vehicle/user context, days = remaining (expiring) / since-expiry (expired)
    expiringParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
    expiredParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
  },
  {
    key: "INSURANCE",
    remainingField: "insurance_expiry_remaining_datys",
    expiringTpl: "PLACEHOLDER_insurance_expiring",
    expiredTpl: "PLACEHOLDER_insurance_expired",
    expiringParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
    expiredParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
  },
  {
    key: "PUCC",
    remainingField: "pucc_expiry_remaining_datys",
    expiringTpl: "PLACEHOLDER_pucc_expiring",
    expiredTpl: "PLACEHOLDER_pucc_expired",
    expiringParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
    expiredParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
  },
  {
    key: "PERMIT",
    remainingField: "permit_days",
    expiringTpl: "PLACEHOLDER_permit_expiring",
    expiredTpl: "PLACEHOLDER_permit_expired",
    expiringParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
    expiredParams: (ctx, days) => [ctx.user_name, ctx.reg_no, String(days)],
  },
];

/** Format a DB date/timestamp value to "YYYY-MM-DD". */
const toDateStr = (d) => {
  if (!d) return "N/A";
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? "N/A" : dt.toISOString().split("T")[0];
};

/* ------------------------------------------------------------------ *
 * Part 1 — subscription lifecycle alerts (one message per vehicle).
 * ------------------------------------------------------------------ */
const handleSubscriptionAlerts = async (ctx) => {
  const { user_name, mobile_number, reg_no, expiry_days, expires_on } = ctx;
  const expiry_date = toDateStr(expires_on);

  try {
    if (expiry_days < 0) {
      // Expired: re-nudge every 7th day after the expiry date.
      const daysAfter = Math.abs(expiry_days);
      if (daysAfter > 0 && daysAfter % SUBSCRIPTION_EXPIRED_EVERY === 0) {
        await sendWhatsApp({
          mobile_number,
          template: TPL.SUB_EXPIRED,
          params: [user_name, reg_no, expiry_date, String(daysAfter)],
        });
        console.log(
          `[alerts] sub-expired nudge → ${mobile_number} ${reg_no} (+${daysAfter}d)`,
        );
      }
    } else if (SUBSCRIPTION_EXPIRING_DAYS.includes(expiry_days)) {
      // Not yet expired: remind at 30/15/7/3/1 days remaining.
      await sendWhatsApp({
        mobile_number,
        template: TPL.SUB_EXPIRING,
        params: [user_name, reg_no, expiry_date, String(expiry_days)],
      });
      console.log(
        `[alerts] sub-expiring → ${mobile_number} ${reg_no} (${expiry_days}d left)`,
      );
    }
  } catch (err) {
    console.error(
      `[alerts] subscription alert failed for ${mobile_number} ${reg_no}:`,
      err.message,
    );
  }
};

/* ------------------------------------------------------------------ *
 * Part 2.1 — RC/insurance/PUCC/permit expiry alerts.
 * On an exact threshold match we re-fetch the RC from the external API,
 * refresh the whole row, then send the per-document alert.
 * ------------------------------------------------------------------ */
const handleDocumentAlerts = async (ctx, external) => {
  const { mobile_number, reg_no, rcId } = ctx;

  // Attach today's cached remaining-days to each document config.
  const documents = DOCUMENTS.map((doc) => ({
    ...doc,
    remaining: ctx[doc.remainingField],
  }));

  const upcoming = documents.filter(
    (d) => d.remaining != null && DOCUMENT_EXPIRING_DAYS.includes(d.remaining),
  );
  // Expired: only re-nudge at 1, 7 and 15 days after expiry, then stop
  // (remaining is negative, so -1 / -7 / -15).
  const expired = documents.filter(
    (d) =>
      d.remaining != null &&
      d.remaining < 0 &&
      DOCUMENT_EXPIRED_DAYS.includes(Math.abs(d.remaining)),
  );

  // Re-fetch + refresh the row ONCE if any document hit a threshold AND we
  // actually have fresh RC data (never overwrite the row with an empty payload
  // when the external fetch failed).
  if (upcoming.length > 0) {
    const rcData = external?.rc?.data?.data;
    if (rcData && Object.keys(rcData).length > 0) {
      try {
        const { myqueryrcu, valuesrcu } = getRCUpdateQuery(rcId, rcData);
        await pool.query(myqueryrcu, valuesrcu);
        console.log(`[alerts] rc_details refreshed for ${reg_no} (id ${rcId})`);
      } catch (err) {
        console.error(
          `[alerts] rc refresh failed for ${reg_no} (id ${rcId}):`,
          err.message,
        );
      }
    } else {
      console.warn(
        `[alerts] skipped rc refresh for ${reg_no} (no external data); alerting on cached values`,
      );
    }

    for (const doc of upcoming) {
      try {
        // Per-document EXPIRING template + params (placeholders — replace the
        // template name and params() for this document in the DOCUMENTS config).
        await sendWhatsApp({
          mobile_number,
          template: doc.expiringTpl,
          params: doc.expiringParams(ctx, doc.remaining),
        });
        console.log(
          `[alerts] doc-expiring ${doc.key} → ${mobile_number} ${reg_no} (${doc.remaining}d)`,
        );
      } catch (err) {
        console.error(
          `[alerts] doc-expiring ${doc.key} failed for ${reg_no}:`,
          err.message,
        );
      }
    }
  }

  for (const doc of expired) {
    try {
      // Per-document EXPIRED template + params (placeholders — replace in the
      // DOCUMENTS config). Cadence: 1, 7 and 15 days after expiry, then stops.
      await sendWhatsApp({
        mobile_number,
        template: doc.expiredTpl,
        params: doc.expiredParams(ctx, Math.abs(doc.remaining)),
      });
      console.log(
        `[alerts] doc-expired ${doc.key} → ${mobile_number} ${reg_no}`,
      );
    } catch (err) {
      console.error(
        `[alerts] doc-expired ${doc.key} failed for ${reg_no}:`,
        err.message,
      );
    }
  }
};

/* ------------------------------------------------------------------ *
 * Part 2.2 — challan check (fires on challan_days == 0).
 * Re-fetch challans, insert new ones (+ violations), then alert.
 * ------------------------------------------------------------------ */
const handleChallanCheck = async (ctx, external) => {
  const { mobile_number, reg_no, rcId } = ctx;
  try {
    const challanBody = external?.challan?.data?.data;
    const count = challanBody?.echallan_count || 0;
    let inserted = 0;

    for (let i = 0; i < count; i++) {
      const item = challanBody.data[i];
      const { myquerych, valuesch } = getChallanInsertQuery(rcId, item);
      // challan_no is globally unique — skip already-stored challans.
      const query = myquerych.replace(
        /\s*returning/i,
        " ON CONFLICT (challan_no) DO NOTHING returning",
      );
      const stored = await pool.query(query, valuesch);
      if (stored.rows.length === 0) continue; // duplicate — skipped
      inserted += 1;
      for (let j = 0; j < (item.violation_details?.length || 0); j++) {
        await pool.query(
          `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3)`,
          [
            stored.rows[0].id,
            item.violation_details[j].offence,
            item.violation_details[j].penalty,
          ],
        );
      }
    }
    console.log(
      `[alerts] challan check ${reg_no}: ${count} from API, ${inserted} new`,
    );

    const alert = count > 0 ? CHALLAN_ALERT.found : CHALLAN_ALERT.none;
    await sendWhatsApp({
      mobile_number,
      template: alert.template,
      params: alert.params(ctx, count),
    });
  } catch (err) {
    console.error(`[alerts] challan check failed for ${reg_no}:`, err.message);
  }
};

/* ------------------------------------------------------------------ *
 * Part 3 — feedback nudge (fires on users.feedback_days == 0, ~every 28 days).
 * ------------------------------------------------------------------ */
const handleFeedbackAlert = async (ctx) => {
  const { mobile_number, reg_no } = ctx;
  try {
    await sendWhatsApp({
      mobile_number,
      template: FEEDBACK_ALERT.template,
      params: FEEDBACK_ALERT.params(ctx),
    });
    console.log(`[alerts] feedback nudge → ${mobile_number} ${reg_no}`);
  } catch (err) {
    console.error(`[alerts] feedback alert failed for ${reg_no}:`, err.message);
  }
};

/* ------------------------------------------------------------------ *
 * Part 4 — Vehicle Document Health (VDH) report, per vehicle, fired on the
 * same ~28-day account cadence (users.feedback_days == 0).
 * ------------------------------------------------------------------ */
const handleVDHReport = async (ctx) => {
  const { mobile_number, reg_no } = ctx;
  try {
    await sendWhatsApp({
      mobile_number,
      template: VDH_ALERT.template,
      params: VDH_ALERT.params(ctx),
    });
    console.log(`[alerts] VDH report → ${mobile_number} ${reg_no}`);
  } catch (err) {
    console.error(`[alerts] VDH report failed for ${reg_no}:`, err.message);
  }
};

/* ------------------------------------------------------------------ *
 * Orchestrator — called once per day from the cron's doAlertJob().
 * ------------------------------------------------------------------ */
const dailyAlerts = async () => {
  console.log("[alerts] doAlertJob started");
  let subsProcessed = 0;
  let vehiclesProcessed = 0;

  try {
    // Active subscriptions + their user. expiry_days is kept fresh by
    // recalcRcExpiryDays earlier in the same daily tick.
    const subs = await pool.query(`
      SELECT us.id AS sub_id, us.fk_users AS user_id, us.expires_on,
             us.expiry_days, us.active_on,
             u.user_name, u.mobile_number, u.feedback_days
      FROM user_subscribed us
      JOIN users u ON u.id = us.fk_users
      WHERE COALESCE(u.is_active, true) = true
        AND COALESCE(us.is_active, true) = true
    `);

    for (const sub of subs.rows) {
      subsProcessed += 1;

      // Vehicles owned by this user (per-account subscription covers all).
      let vehicles;
      try {
        vehicles = await pool.query(
          `SELECT id AS rc_id, reg_no,
                  rc_expiry_remaining_datys, insurance_expiry_remaining_datys,
                  pucc_expiry_remaining_datys, permit_days, challan_days
           FROM rc_details
           WHERE fk_users = $1 AND COALESCE(is_active, true) = true
           ORDER BY created_at`,
          [sub.user_id],
        );
      } catch (err) {
        console.error(
          `[alerts] vehicle fetch failed for user ${sub.user_id}:`,
          err.message,
        );
        continue;
      }

      const subscriptionExpired = sub.expiry_days < 0;

      for (const v of vehicles.rows) {
        vehiclesProcessed += 1;
        const ctx = {
          user_name: sub.user_name,
          mobile_number: sub.mobile_number,
          expires_on: sub.expires_on,
          expiry_days: sub.expiry_days,
          active_on: sub.active_on,
          reg_no: v.reg_no,
          rcId: v.rc_id,
          rc_expiry_remaining_datys: v.rc_expiry_remaining_datys,
          insurance_expiry_remaining_datys: v.insurance_expiry_remaining_datys,
          pucc_expiry_remaining_datys: v.pucc_expiry_remaining_datys,
          permit_days: v.permit_days,
        };

        // Part 1: subscription alerts (run for every vehicle, always).
        await handleSubscriptionAlerts(ctx);

        // Parts 2 & 3 only apply while the subscription is still running.
        if (subscriptionExpired) continue;

        // Decide if we need an external round-trip (RC refresh and/or challan).
        const docThresholdHit = [
          v.rc_expiry_remaining_datys,
          v.insurance_expiry_remaining_datys,
          v.pucc_expiry_remaining_datys,
          v.permit_days,
        ].some((r) => r != null && DOCUMENT_EXPIRING_DAYS.includes(r));
        const challanDue = v.challan_days === 0;

        let external = null;
        if (docThresholdHit || challanDue) {
          try {
            external = await fetchVehicleExternalDetails(v.reg_no);
          } catch (err) {
            console.error(
              `[alerts] external fetch failed for ${v.reg_no}:`,
              err.message,
            );
          }
        }

        // Part 2.1: document expiry. Always runs (handles expired docs even
        // when there was no external round-trip); refreshes the row only when
        // a threshold was hit and fresh RC data is available.
        await handleDocumentAlerts(ctx, external);

        // Part 2.2: challan check (needs the external challan payload).
        if (challanDue && external) await handleChallanCheck(ctx, external);

        // Part 4: VDH report — per vehicle, on the ~28-day account cadence.
        if (sub.feedback_days === 0) await handleVDHReport(ctx);
      }

      // Part 3: feedback nudge — once per ACCOUNT (~every 28 days). The counter
      // lives on the users table (users.feedback_days), so it's naturally one
      // message per user regardless of how many vehicles they own. Uses the
      // primary (oldest) vehicle's reg_no for the message. Skipped for expired
      // subscriptions.
      if (!subscriptionExpired && sub.feedback_days === 0) {
        await handleFeedbackAlert({
          user_name: sub.user_name,
          mobile_number: sub.mobile_number,
          reg_no: vehicles.rows.length > 0 ? vehicles.rows[0].reg_no : "N/A",
        });
      }
    }

    console.log(
      `[alerts] doAlertJob done: ${subsProcessed} subscription(s), ${vehiclesProcessed} vehicle(s)`,
    );
  } catch (err) {
    console.error("[alerts] doAlertJob failed:", err.message);
  }
};

module.exports = dailyAlerts;
