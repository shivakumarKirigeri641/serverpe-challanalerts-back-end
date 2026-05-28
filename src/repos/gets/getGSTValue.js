const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getGSTValue = async () => {
  try {
    const result = await pool.query(
      `select gst_percent, description from gst_percents where is_active=true;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "GST value details fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching offers. Error: ${err.message}`,
    };
  }
};

module.exports = getGSTValue;
