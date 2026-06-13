const { connectDB } = require("../database/connectDB");
const notifyLowWallet = require("./notifyLowWallet");

const pool = connectDB();

/**
 * Atomically deduct one unit's cost from a single-row wallet ledger (id = 1) and
 * email the admin when the balance crosses below `threshold`.
 *
 * `table` and `costCol` are internal constants (never user input), so inlining
 * them in the SQL is safe. Fire-and-forget: never throws — a wallet/email failure
 * must never break the real send/call.
 *
 * @param {object} p
 * @param {string} p.table      wallet table (e.g. "sms_wallet")
 * @param {string} p.costCol    per-unit cost column (e.g. "per_sms_cost")
 * @param {string} p.name       human label for the alert (e.g. "SMS wallet")
 * @param {number} p.threshold  ₹ level that triggers the low-balance email
 */
const deductWallet = async ({ table, costCol, name, threshold }) => {
  try {
    const r = await pool.query(
      `update ${table}
          set balance = balance - ${costCol}, updated_at = now()
        where id = 1
      returning balance, ${costCol}`,
    );
    const row = r.rows[0];
    if (!row) return;
    const newBalance = Number(row.balance);
    notifyLowWallet({
      name,
      prevBalance: newBalance + Number(row[costCol]),
      newBalance,
      threshold,
    });
  } catch (err) {
    console.error(`deductWallet(${table}) failed:`, err.message);
  }
};

module.exports = deductWallet;
