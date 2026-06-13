const { connectDB } = require("../../database/connectDB");
const sendFeedbackAlertSMS = require("../../comms/sendFeedbackAlertSMS");
const pool = connectDB();

const postFeedback = async (user_name, rating, message, photopath = null) => {
  try {
    await pool.query("BEGIN");
    const result = await pool.query(
      `INSERT INTO feedbacks (user_name, rating, message, pic_path)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [user_name, rating, message || null, photopath || null],
    );
    await pool.query("COMMIT");

    // Alert the admin about the new feedback — fire-and-forget so a failed SMS
    // (sendFeedbackAlertSMS throws on error) never breaks the user's submission.
    sendFeedbackAlertSMS(pool, user_name, rating, message || "").catch((e) =>
      console.error("Feedback admin SMS failed:", e?.message),
    );

    return {
      statuscode: 200,
      successstatus: true,
      message: "Feedback recorded successfully",
      data: result.rows[0],
    };
  } catch (err) {
    await pool.query("ROLLBACK");
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in saving feedback. Error: ${err.message}`,
    };
  }
};
module.exports = postFeedback;
