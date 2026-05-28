const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
const checkIfMobileNumberAlreadySubscribed = async (mobile_number) => {
  try {
    const result = await pool.query(
      `SELECT id from users where mobile_number =$1`,
      [mobile_number],
    );
    if (0 < result.rows.length) {
      return {
        statuscode: 401,
        successstatus: false,
        message: `User already subscribed in platform!`,
      };
    } else {
      return {
        statuscode: 200,
        successstatus: true,
        message: `New user subscription!`,
        data: result.rows,
      };
    }
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching user details. Error: ${err.message}`,
    };
  }
};

module.exports = checkIfMobileNumberAlreadySubscribed;
