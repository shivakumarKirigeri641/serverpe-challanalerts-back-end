const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Consent Policy clauses for the public legal page.
 *
 * WHAT  : Active `consent_policy` rows (title, description, display_order), ordered.
 * WHY   : Documents what the user consents to when authorising us to fetch their
 *         vehicle data — must be DB-managed/editable. (Same pattern as getTerms.)
 * WHERE : publicRouter "GET /agreements/consent-policy".
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Admin-editable consent text, no redeploy; supports the data-fetch authorisation.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getConsentPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from consent_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "consent_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching consent_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getConsentPolicy;
