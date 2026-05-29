const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getLiabilitiesPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from liabilities_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "liabilities_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching liabilities_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getLiabilitiesPolicy;
