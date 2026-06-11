const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Refund Policy clauses for the public legal page.
 *
 * WHAT  : Active `refund_policy` rows (title, description, display_order), ordered.
 * WHY   : Required for the payment gateway (Razorpay) and buyer trust; must be
 *         DB-managed/editable. (Same pattern as getTerms.)
 * WHERE : publicRouter "GET /agreements/refund-policy".
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Gateway-compliant, admin-editable refund text with no redeploy.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getRefundPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from refund_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "refund_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching refund_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getRefundPolicy;
