const { connectDB } = require("../../database/connectDB");

const pool = connectDB();

/**
 * Provider wallet (external_api_calls billing) — single-row ledger at id = 1.
 * Admin recharges by ADDING to the existing balance; every external API call
 * deducts `per_call_cost` (see logExternalApiCall).
 */
/**
 * Generic single-row wallet recharge — adds `amount` to a wallet table's balance.
 * @param {string} table     wallet table name
 * @param {string} costCol   the per-unit cost column to echo back
 */
const recharge = async (table, costCol, amount) => {
  try {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0)
      return {
        statuscode: 400,
        successstatus: false,
        message: "Enter a valid amount greater than 0",
      };

    const r = await pool.query(
      `update ${table}
          set balance = balance + $1, updated_at = now()
        where id = 1
      returning balance, ${costCol}`,
      [amt],
    );
    if (r.rows.length === 0)
      return {
        statuscode: 404,
        successstatus: false,
        message: "Wallet not initialised",
      };

    return {
      statuscode: 200,
      successstatus: true,
      message: `Added ₹${amt.toFixed(2)} to the wallet`,
      data: {
        balance: Number(r.rows[0].balance),
        [costCol]: Number(r.rows[0][costCol]),
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to recharge wallet. Error: ${err.message}`,
    };
  }
};

const rechargeWallet = (amount) =>
  recharge("external_api_wallet", "per_call_cost", amount);
const rechargeSmsWallet = (amount) =>
  recharge("sms_wallet", "per_sms_cost", amount);

module.exports = { rechargeWallet, rechargeSmsWallet };
