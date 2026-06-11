const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch published customer feedback (testimonials) for the landing page.
 *
 * WHAT  : Returns active feedbacks, newest first.
 * WHY   : Social proof on the landing page. is_active is the moderation switch —
 *         a submitted feedback only appears here once an admin approves it, so
 *         spam/abuse never auto-publishes.
 * WHERE : publicRouter "GET /feedbacks" — drives the Feedbacks/testimonials carousel.
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Curated testimonials wall, fully admin-controlled, no redeploy to update.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getFeedbacks = async () => {
  try {
    const result = await pool.query(
      `select *from feedbacks where is_active=true order by created_at desc;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "Feedbacks fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching feedbacks. Error: ${err.message}`,
    };
  }
};

module.exports = getFeedbacks;
