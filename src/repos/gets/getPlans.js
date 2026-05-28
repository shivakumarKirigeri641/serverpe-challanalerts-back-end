const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getPlans = async (is_trail_included = true) => {
  try {
    let result = await pool.query(
      is_trail_included === true
        ? `select *from subscription_plans where is_active=true order by price;`
        : `select *from subscription_plans where is_active=true and price>0 order by price;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "Plans fetched successfully",
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

module.exports = getPlans;
