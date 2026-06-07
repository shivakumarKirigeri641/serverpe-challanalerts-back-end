const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
const axios = require("axios");
require("dotenv").config();
const getStatesAndUnions = async () => {
  try {
    const result = await pool.query(
      `SELECT id, state_union_code, rto_code, state_union_name, is_union_territory from states_unions where
      is_active=true order by state_union_name;`,
    );
    //test whatsapp
    return {
      statuscode: 200,
      successstatus: true,
      message: "States/unions fetched successfully",
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

module.exports = getStatesAndUnions;
