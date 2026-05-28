const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

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
