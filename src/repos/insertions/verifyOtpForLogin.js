const { connectDB } = require("../../database/connectDB");
const updateUserAndAddress = require("./updateUserAndAddress");
const pool = connectDB();
const verifyOtpForLogin = async (mobile_number, otp) => {
  try {
    await pool.query(`BEGIN`);
    let result = await pool.query(
      `delete from otp_sessions where expires_at < NOW()`,
    );
    result = await pool.query(
      `select *from otp_sessions where mobile_number=$1 and otp=$2`,
      [mobile_number, otp],
    );
    if (0 === result.rows.length) {
      return {
        statuscode: 404,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `OTP expired / invalid OTP!`,
      };
    }
    result = await pool.query(
      `delete from otp_sessions where mobile_number=$1 and otp=$2`,
      [mobile_number, otp],
    );
    await pool.query(`COMMIT`);
    return {
      statuscode: 201,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: `OTP verification successfull.`,
    };
  } catch (err) {
    await pool.query(`ROLLBACK`);
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed verify subscriptin otp. Error:${err.message}`,
    };
  }
};
module.exports = verifyOtpForLogin;
