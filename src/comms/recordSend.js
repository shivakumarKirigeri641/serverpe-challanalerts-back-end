const { connectDB } = require("../database/connectDB");
const { costFor } = require("../utils/messageCost");
const deductWallet = require("./deductWallet");
const pool = connectDB();

/**
 * Centralised notification logger (comms layer). Records ONE WhatsApp/SMS send
 * into message_logs with its cost, so EVERY send is captured regardless of
 * caller. Resolves fk_users from the mobile number when possible (NULL otherwise
 * — e.g. admin alerts to a non-user number, which is why fk_users is nullable).
 * Fire-and-forget: never throws (a logging failure must not break a send).
 *
 * NOTE: the recurring alert/VDH jobs write their OWN message_logs rows (for
 * once-per-day dedup + cost), so recordSend is used only by the other senders —
 * this avoids double-counting the same send.
 *
 * @param {object} p
 * @param {string|number} p.mobile_number  recipient (used to resolve fk_users)
 * @param {'WHATSAPP'|'SMS'|'EMAIL'} p.channel
 * @param {boolean} p.sent                 was it actually sent? (drives is_sent + cost)
 * @param {string} [p.kind]                label stored in comments (OTP/WELCOME/VDH/…)
 * @param {number} [p.fk_rc_details]
 */
const recordSend = async ({
  mobile_number,
  channel,
  sent,
  kind = null,
  fk_rc_details = null,
}) => {
  try {
    let fk_users = null;
    if (mobile_number != null && String(mobile_number).trim() !== "") {
      const u = await pool.query(
        `select id from users where mobile_number = $1 limit 1`,
        [String(mobile_number)],
      );
      fk_users = u.rows[0]?.id ?? null;
    }
    await pool.query(
      `insert into message_logs
         (fk_users, fk_rc_details, message_type, message_content, is_sent, is_failed, comments, cost)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        fk_users,
        fk_rc_details,
        channel,
        kind || channel, // message_content is NOT NULL
        !!sent,
        !sent,
        kind,
        costFor(channel, !!sent),
      ],
    );

    // Deduct from the SMS provider wallet on an actual SMS send (single-row
    // ledger; admin recharges it) and email the admin if it crosses below ₹50.
    if (sent && String(channel).toUpperCase() === "SMS") {
      await deductWallet({
        table: "sms_wallet",
        costCol: "per_sms_cost",
        name: "SMS wallet",
        threshold: 50,
      });
    }
  } catch (err) {
    console.error("recordSend failed:", err.message);
  }
};

module.exports = recordSend;
