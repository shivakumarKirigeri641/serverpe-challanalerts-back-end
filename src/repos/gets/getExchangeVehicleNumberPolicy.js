const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the Exchange-Vehicle-Number Policy clauses for the public legal page.
 *
 * WHAT  : Active `exchange_vehicle_number_policy` rows (title, description,
 *         display_order), ordered.
 * WHY   : Explains the rules/cost of swapping a vehicle on an active subscription
 *         (the "replace a vehicle" paid flow) — must be DB-managed. (Pattern = getTerms.)
 * WHERE : publicRouter "GET /agreements/exchange-vehicle-number-policy"; shown in the
 *         replace-vehicle flow.
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: Transparent, editable swap terms tied to the replace-vehicle feature.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getExchangeVehicleNumberPolicy = async () => {
  try {
    const result = await pool.query(
      `select title, description, display_order from exchange_vehicle_number_policy where is_active=true order by display_order;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "exchange_vehicle_number_policy fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in fetching exchange_vehicle_number_policy. Error: ${err.message}`,
    };
  }
};

module.exports = getExchangeVehicleNumberPolicy;
