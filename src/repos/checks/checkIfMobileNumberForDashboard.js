const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Dashboard-login guard — does an account exist for this mobile number?
 *
 * WHAT  : Looks up users by mobile_number. This is the INVERSE of the subscribe
 *         check: here a MISSING user is the failure case.
 * WHY   : The dashboard is for existing subscribers only. We confirm the account
 *         exists before sending a login OTP, so a stranger's number can't trigger
 *         OTP spam and the user gets a clear "not found" message.
 * WHERE : publicRouter "POST /dashboard/send-otp", before generating the OTP.
 * HOW   : ServerPe envelope — false (401) when no user, true (200) when found.
 *         Never throws (DB errors → 500).
 * BENEFIT: Stops OTP delivery to non-subscribers and gives a precise error early.
 *
 * @param {string} mobile_number  cleaned 10-digit mobile
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const checkIfMobileNumberForDashboard = async (mobile_number) => {
  try {
    const result = await pool.query(
      `SELECT id from users where mobile_number =$1`,
      [mobile_number],
    );
    if (0 === result.rows.length) {
      return {
        statuscode: 401,
        successstatus: false,
        message: `User with this mobile number not found!`,
      };
    } else {
      return {
        statuscode: 200,
        successstatus: true,
        message: `Subscribed user.`,
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

module.exports = checkIfMobileNumberForDashboard;
