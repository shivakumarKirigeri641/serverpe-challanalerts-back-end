const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the active "contact us / enquiry" categories.
 *
 * WHAT  : Returns all active rows from query_types (id, code, title, description).
 * WHY   : The Contact form needs a fixed, admin-managed list of subjects (general
 *         query, fleet enquiry, complaint, …) rather than free text, so messages
 *         can be routed/triaged. is_active lets admins retire a category without
 *         deleting historical references.
 * WHERE : publicRouter "GET /query-types" — loaded by the landing-page Contact form.
 * HOW   : Read-only; returns the ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Centralised, data-driven dropdown — change categories in the DB, no deploy.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getQueryTypes = async () => {
  try {
    const result = await pool.query(
      `SELECT id, code, title, description FROM query_types WHERE is_active = true`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "Query types fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching query types. Error: ${err.message}`,
    };
  }
};

module.exports = getQueryTypes;
