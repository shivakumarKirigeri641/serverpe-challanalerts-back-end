const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getPlans = async (is_trail_included = true) => {
  try {
    // The trial plan is flagged is_trial=true. When the trial is excluded
    // (dashboard upgrade list) we drop it so it never appears as a
    // renewal/upgrade option.
    let result = await pool.query(
      is_trail_included === true
        ? `select *from subscription_plans where is_active=true order by price;`
        : `select *from subscription_plans
             where is_active=true and coalesce(is_trial,false)=false
             order by price;`,
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
