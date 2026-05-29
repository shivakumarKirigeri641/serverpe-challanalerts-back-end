const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getConsentPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from consent_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "consent_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching consent_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getConsentPolicy;
