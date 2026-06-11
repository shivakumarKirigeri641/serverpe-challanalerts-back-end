const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Pre-subscription guard — is this vehicle already on the platform?
 *
 * WHAT  : Looks up rc_details by registration number (upper-cased so any casing
 *         of the same plate matches the stored row).
 * WHY   : A plate may be protected under only one account; this blocks a second
 *         user — or a duplicate/retried request — from re-subscribing a vehicle
 *         that already exists, BEFORE any rows are written.
 * WHERE : publicRouter "POST /subscribe/send-otp", run before the OTP is sent so
 *         a duplicate is rejected without spending an SMS.
 * HOW   : Returns the standard ServerPe envelope — successstatus=false (401) when
 *         the plate exists, true (200) when it's new. Never throws (DB errors → 500).
 * BENEFIT: Cheap, early duplicate-prevention that keeps subscribe idempotent and
 *         avoids partial/duplicate vehicle records.
 *
 * @param {string} vehicle_number  raw registration plate (any case)
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const checkIfVehicleExists = async (vehicle_number) => {
  try {
    vehicle_number = vehicle_number.toUpperCase();
    const result = await pool.query(
      `SELECT id from rc_details where reg_no =$1`,
      [vehicle_number.toUpperCase()],
    );
    if (0 < result.rows.length) {
      return {
        statuscode: 401,
        successstatus: false,
        message: `Vehicle already present in platform!`,
      };
    } else {
      return {
        statuscode: 200,
        successstatus: true,
        message: `Vehicle is new!`,
        data: result.rows,
      };
    }
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching Vehicle details. Error: ${err.message}`,
    };
  }
};

module.exports = checkIfVehicleExists;
