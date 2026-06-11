const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Persist a single API activity row into api_logs.
 *
 * This is intentionally fail-safe: a logging error must NEVER break the actual
 * request the user made, so all errors are swallowed (only console-logged).
 * Call it fire-and-forget (don't await it inside the request lifecycle).
 */
const insertApiLog = async (log) => {
  try {
    await pool.query(
      `INSERT INTO api_logs
         (method, endpoint, mobile_number, vehicle_number, ip_address,
          device_info, user_agent, request_body, query_params,
          status_code, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
      [
        log.method || null,
        log.endpoint || null,
        log.mobile_number || null,
        log.vehicle_number || null,
        log.ip_address || null,
        log.device_info || null,
        log.user_agent || null,
        log.request_body ? JSON.stringify(log.request_body) : null,
        log.query_params ? JSON.stringify(log.query_params) : null,
        Number.isFinite(log.status_code) ? log.status_code : null,
        Number.isFinite(log.response_time_ms) ? log.response_time_ms : null,
      ],
    );
  } catch (err) {
    console.error("api_logs insert failed:", err.message);
  }
};

module.exports = insertApiLog;
