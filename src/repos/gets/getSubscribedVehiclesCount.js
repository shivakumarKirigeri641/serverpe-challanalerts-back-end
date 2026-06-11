const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Live count of subscribed vehicles (rows in rc_details), used to drive the
 * landing-page social-proof line ("N vehicles subscribed, be the next one")
 * and the launch offer: free 1-year subscription for the first 100 vehicles.
 *
 * Counts only active vehicles (coalesce(is_active, true)=true) so a replaced /
 * retired vehicle doesn't inflate the number.
 */
const FREE_OFFER_LIMIT = 100;

const getSubscribedVehiclesCount = async () => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM rc_details
            WHERE COALESCE(is_active, true) = true)::int AS count,
         (SELECT COUNT(*) FROM rc_details
            WHERE free_year_offer = true)::int AS granted`,
    );
    const count = result.rows[0]?.count || 0;
    // remaining_slots tracks grants actually made (matches subscribeUser), so it
    // never reopens once 100 vehicles have claimed the free year.
    const granted = result.rows[0]?.granted || 0;
    const remaining_slots = Math.max(0, FREE_OFFER_LIMIT - granted);

    return {
      statuscode: 200,
      successstatus: true,
      message: "Subscribed vehicles count fetched successfully",
      data: {
        count,
        granted,
        offer_limit: FREE_OFFER_LIMIT,
        remaining_slots,
        offer_active: remaining_slots > 0,
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching subscribed vehicles count. Error: ${err.message}`,
    };
  }
};

module.exports = getSubscribedVehiclesCount;
