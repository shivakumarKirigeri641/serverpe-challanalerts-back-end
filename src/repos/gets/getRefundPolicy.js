const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

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
