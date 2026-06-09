const sendOtpSMS = require("../../comms/sendOtpSMS");
const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
const insertOtpForSubscription = async (mobile_number, otp) => {
  try {
    let result = await pool.query(
      `delete from otp_sessions where expires_at < NOW()`,
    );
    result = await pool.query(
      `insert into otp_sessions (mobile_number, otp, expires_at) values ($1,$2, NOW() + INTERVAL '3 minutes')`,
      [mobile_number, otp],
    );
    //send sms
    const result_sms_response_details = await sendOtpSMS(
      pool,
      mobile_number,
      otp,
    );
    return {
      statuscode: 201,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: `OTP sent successfully.`,
    };
  } catch (err) {
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed to insert subscriptin otp`,
    };
  }
};
module.exports = insertOtpForSubscription;
