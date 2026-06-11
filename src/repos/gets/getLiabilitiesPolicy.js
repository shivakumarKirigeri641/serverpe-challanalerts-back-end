const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Liabilities Policy clauses for the public legal page.
 *
 * WHAT  : Active `liabilities_policy` rows (title, description, display_order), ordered.
 * WHY   : Limits/explains our liability (e.g. alerts are best-effort, sourced from
 *         third-party govt data that may lag) — must be DB-managed. (Pattern = getTerms.)
 * WHERE : publicRouter "GET /agreements/liabilities-policy".
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Clear, editable liability terms backing the data-accuracy disclaimers.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getLiabilitiesPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from liabilities_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "liabilities_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching liabilities_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getLiabilitiesPolicy;
