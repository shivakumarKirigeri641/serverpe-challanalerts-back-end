const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Active replace-a-vehicle offers (price > 0), cheapest first. Mirrors getPlans
 * but reads the replacement_plan table. Each row carries `price` (charged) and
 * `comparable_price` (the struck-through reference price the UI shows).
 */
const getReplacementPlans = async () => {
  try {
    let result = await pool.query(
      `select * from replacement_plan where is_active=true and price>0 order by price;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "Replacement plans fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching replacement plans. Error: ${err.message}`,
    };
  }
};

module.exports = getReplacementPlans;
