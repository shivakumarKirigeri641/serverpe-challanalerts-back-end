const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Pre-subscription guard — is this mobile number already an account?
 *
 * WHAT  : Looks up users by mobile_number.
 * WHY   : One account per mobile number (the users table enforces it with a
 *         unique constraint). This rejects a repeat sign-up early, before the
 *         OTP step, so the user is told "already subscribed" instead of hitting
 *         a confusing constraint error mid-transaction.
 * WHERE : publicRouter "POST /subscribe/send-otp", alongside checkIfVehicleExists.
 * HOW   : ServerPe envelope — false (401) when the number exists, true (200) when new.
 *         Never throws (DB errors → 500).
 * BENEFIT: Early, friendly duplicate-account prevention; saves an SMS and keeps
 *         the subscribe flow clean.
 *
 * @param {string} mobile_number  cleaned 10-digit mobile
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
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
