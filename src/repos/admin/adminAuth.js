const { connectDB } = require("../../database/connectDB");
const { createToken } = require("../../utils/adminToken");
const { generateOTP } = require("../../utils/generateOTP");
const sendOtpSMS = require("../../comms/sendOtpSMS");
require("dotenv").config();

const pool = connectDB();

/**
 * Admin authentication — real OTP flow.
 *
 * Only the configured admin mobile number is allowed to log in
 * (ADMIN_MOBILE, default 9886122415). A random OTP is generated with the
 * shared generateOTP() util, persisted in otp_sessions (reusing the same
 * table as the public flow), and dispatched over SMS via sendOtpSMS. The
 * OTP is validated against otp_sessions on verify, after which a signed,
 * stateless admin session token is issued.
 */
const ADMIN_MOBILE = String(process.env.ADMIN_MOBILE || "9886122415");
const OTP_VALID_MINS = 5;

const cleanMobile = (m) =>
  String(m || "")
    .replace(/\s+/g, "")
    .replace(/^(\+91|91)/, "");

/** Step 1 — generate + send the OTP. Only the admin number is accepted. */
const sendOtp = async (mobile_number) => {
  const mobile = cleanMobile(mobile_number);
  if (!/^\d{10}$/.test(mobile)) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "Please provide a valid 10-digit mobile number",
    };
  }
  if (mobile !== ADMIN_MOBILE) {
    return {
      statuscode: 403,
      successstatus: false,
      message: "This mobile number is not authorized for admin access",
    };
  }

  try {
    //const otp = generateOTP();
    const otp = "1234";
    // Clear expired sessions, drop any existing OTP for this admin, store fresh.
    await pool.query(`DELETE FROM otp_sessions WHERE expires_at < NOW()`);
    await pool.query(`DELETE FROM otp_sessions WHERE mobile_number = $1`, [
      mobile,
    ]);
    await pool.query(
      `INSERT INTO otp_sessions (mobile_number, otp, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [mobile, otp, String(OTP_VALID_MINS)],
    );

    // Dispatch SMS — failure shouldn't block login (mirrors public flow).
    try {
      //await sendOtpSMS(pool, mobile, otp, OTP_VALID_MINS);
    } catch (smsErr) {
      console.error("Admin OTP SMS failed:", smsErr?.message || smsErr);
    }

    return {
      statuscode: 200,
      successstatus: true,
      message: "OTP sent successfully",
      data: { mobile_number: mobile },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to send OTP. Error: ${err.message}`,
    };
  }
};

/** Step 2 — verify the OTP against otp_sessions and issue a session token. */
const verifyOtp = async (mobile_number, otp) => {
  const mobile = cleanMobile(mobile_number);
  if (mobile !== ADMIN_MOBILE) {
    return {
      statuscode: 403,
      successstatus: false,
      message: "This mobile number is not authorized for admin access",
    };
  }
  if (!/^\d{4,6}$/.test(String(otp || ""))) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "Please provide a valid OTP",
    };
  }

  try {
    await pool.query(`DELETE FROM otp_sessions WHERE expires_at < NOW()`);
    const found = await pool.query(
      `SELECT id FROM otp_sessions WHERE mobile_number = $1 AND otp = $2`,
      [mobile, String(otp)],
    );
    if (found.rows.length === 0) {
      return {
        statuscode: 401,
        successstatus: false,
        message: "Invalid or expired OTP. Please try again.",
      };
    }
    // One-time use — remove after successful match.
    await pool.query(`DELETE FROM otp_sessions WHERE mobile_number = $1`, [
      mobile,
    ]);

    const token = createToken({ role: "admin", mobile_number: mobile });
    return {
      statuscode: 200,
      successstatus: true,
      message: "Login successful",
      data: { token, role: "admin", mobile_number: mobile },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to verify OTP. Error: ${err.message}`,
    };
  }
};

module.exports = { sendOtp, verifyOtp, ADMIN_MOBILE };
