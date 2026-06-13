const { connectDB } = require("../../database/connectDB");
const deductWallet = require("../../comms/deductWallet");
const pool = connectDB();

/* Credential-ish keys we must never persist in request_params. */
const SENSITIVE = [
  "api_key",
  "api_id",
  "token_id",
  "key",
  "token",
  "password",
  "authorization",
  "secret",
];

const maskParams = (params) => {
  if (!params || typeof params !== "object") return params ?? null;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = SENSITIVE.includes(String(k).toLowerCase()) ? "***" : v;
  }
  return out;
};

/**
 * Records ONE billable external API call into external_api_calls.
 *
 * WHAT  : Inserts a row per call with the api_name + (masked) params, plus a
 *         per-day running counter `daily_count` that starts at 1 on the first
 *         call each day and resets the next day (it's count-of-today + 1).
 * WHY   : External vehicle-data calls (RC, and later challan/fastag) are billed
 *         (~₹2.9/RC call). This is the single source of truth for "how many
 *         external calls did we make today, to which API, with what params".
 *         (WhatsApp/SMS notification costs are tracked separately in message_logs.)
 * WHERE : Called from wherever an external call actually happens — currently the
 *         RC lookup in insertNewVehicle.fetchVehicleExternalDetails. Fire-and-forget.
 * HOW   : Fail-safe — never throws (a logging failure must not break the real
 *         call or its caller). Credentials in params are masked.
 *
 * @param {object} p { api_name, endpoint?, reg_no?, params?, success?, status_code?, response_time_ms? }
 */
const logExternalApiCall = async ({
  api_name,
  endpoint = null,
  reg_no = null,
  params = null,
  success = null,
  status_code = null,
  response_time_ms = null,
}) => {
  try {
    await pool.query(
      `insert into external_api_calls
         (api_name, endpoint, reg_no, request_params, success, status_code,
          response_time_ms, daily_count)
       values ($1,$2,$3,$4,$5,$6,$7,
         (select count(*) + 1 from external_api_calls where call_date = CURRENT_DATE))`,
      [
        api_name,
        endpoint,
        reg_no,
        params ? JSON.stringify(maskParams(params)) : null,
        success,
        status_code,
        response_time_ms,
      ],
    );

    // Deduct the per-call cost from the provider wallet (single-row ledger) and
    // email the admin if it crosses below ₹100. Fire-and-forget — a wallet
    // failure must never break the real call.
    await deductWallet({
      table: "external_api_wallet",
      costCol: "per_call_cost",
      name: "External API wallet",
      threshold: 100,
    });
  } catch (err) {
    console.error("logExternalApiCall failed:", err.message);
  }
};

module.exports = logExternalApiCall;
