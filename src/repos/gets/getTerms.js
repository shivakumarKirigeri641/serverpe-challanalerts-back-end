const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

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
