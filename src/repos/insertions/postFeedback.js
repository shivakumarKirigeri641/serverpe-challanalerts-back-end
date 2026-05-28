const { connectDB } = require("../../database/connectDB");
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
