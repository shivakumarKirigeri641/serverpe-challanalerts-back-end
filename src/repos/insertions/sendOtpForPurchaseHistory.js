const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const sendOtpForPurchaseHistory = async (mobile_number) => {
  try {
    const result_user = await pool.query(
      `SELECT id, user_name FROM users WHERE mobile_number = $1`,
      [mobile_number],
    );
    if (0 === result_user.rows.length) {
      return {
        statuscode: 404,
        successstatus: false,
        message:
          "No order has been placed earlier from this mobile number. Please check the number and try again.",
        data: null,
      };
    }

    await pool.query(`DELETE FROM otp_sessions WHERE expires_at < NOW()`);
    const otp = "6416";
    await pool.query(
      `INSERT INTO otp_sessions (mobile_number, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '3 minutes')`,
      [mobile_number, otp],
    );

    return {
      statuscode: 200,
      successstatus: true,
      message: `OTP sent to your mobile number ending ${String(
        mobile_number,
      ).slice(-4)}. It is valid for 3 minutes.`,
      data: null,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to send OTP. Error: ${err.message}`,
    };
  }
};

module.exports = sendOtpForPurchaseHistory;
