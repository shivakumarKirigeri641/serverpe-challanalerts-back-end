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
    /*result = await pool.query(
      `delete from otp_sessions where mobile_number=$1 and otp=$2`,
      [mobile_number, otp],
    );
    //insert into users
    result = await pool.query(
      `insert into users (user_name, mobile_number, email) values ($1,$2,$3) returning *;`,
      [user_name, mobile_number, email],
    );*/
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
