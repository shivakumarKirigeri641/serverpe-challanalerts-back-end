const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Terms & Conditions clauses for the public legal page.
 *
 * WHAT  : Returns active `terms` rows (title, description, display_order) ordered
 *         by display_order so clauses render in the intended sequence.
 * WHY   : Legal copy must be editable by non-developers and versioned in the DB,
 *         not hard-coded in the front-end. display_order lets admins re-sequence
 *         clauses; is_active retires a clause without deleting it.
 * WHERE : publicRouter "GET /agreements/terms" — rendered by the Terms page and
 *         linked from the subscribe consent checkbox.
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Edit legal text from the DB/admin with zero redeploy; consistent ordering.
 *         (Sibling getters — privacy/consent/refund/liabilities/exchange — follow
 *         this exact pattern against their own tables.)
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getTerms = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from terms where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "terms fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching terms. Error: ${err.message}`,
    };
  }
};

module.exports = getTerms;
