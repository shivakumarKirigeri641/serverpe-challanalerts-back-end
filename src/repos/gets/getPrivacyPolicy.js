const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Privacy Policy clauses for the public legal page.
 *
 * WHAT  : Active `privacy_policy` rows (title, description, display_order), ordered.
 * WHY   : DB-managed legal copy — editable without a deploy; display_order controls
 *         sequence, is_active retires a clause without deletion. (Same pattern as
 *         getTerms — see it for the full rationale.)
 * WHERE : publicRouter "GET /agreements/privacy-policy"; linked from the subscribe
 *         consent checkbox and the Privacy page.
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Compliant, admin-editable privacy text with zero redeploy.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getPrivacyPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from privacy_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "privacy_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching privacy_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getPrivacyPolicy;
