const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
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
