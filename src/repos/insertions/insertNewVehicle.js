const axios = require("axios");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const getFastagInsertQuery = require("../../utils/getFastagInsertQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const logExternalApiCall = require("./logExternalApiCall");

const shouldSkipFastagLookup = (vehicleClass) => {
  const text = String(vehicleClass || "").toLowerCase();
  return /(scooter|motorcycle|two\s*wheeler|2\s*wheeler|2\s*-?wheeler|2w|2\s*wheel(?:er|ers)?|auto[-\s]*rickshaw|autorickshaw|auto rickshaw)/.test(
    text,
  );
};

/**
 * Fetch a vehicle's RC / challan / fastag details from the external IDS APIs.
 *
 * Network-only (NO database work). Callers should run this BEFORE opening their
 * transaction so the slow external HTTP round-trips don't hold a pooled DB
 * connection open — holding a connection across these calls is what exhausts
 * the pool and causes the "downtime" under parallel load.
 *
 * @param {string} vehicle_number cleaned registration plate
 * @returns {Promise<{rc:object, challan:object, fastag:object}>} raw API responses
 */
async function fetchVehicleExternalDetails(vehicle_number) {
  // 🚫 Challan API is DISABLED for now — only the RC lookup is performed.
  //    challan stays null so all downstream challan handling is a no-op.
  // 📊 Every external call is recorded in external_api_calls (fire-and-forget).
  const t0 = Date.now();
  let rc;
  try {
    rc = await axios.post(process.env.IDS_EXTERNAL_API_RC, {
      api_id: process.env.APIID,
      api_key: process.env.IDS_API_KEY,
      token_id: process.env.TOKEN_ID,
      reg_no: vehicle_number,
    });
    logExternalApiCall({
      api_name: "RC",
      endpoint: process.env.IDS_EXTERNAL_API_RC,
      reg_no: vehicle_number,
      params: { reg_no: vehicle_number },
      success: true,
      status_code: rc?.status ?? null,
      response_time_ms: Date.now() - t0,
    });
  } catch (err) {
    logExternalApiCall({
      api_name: "RC",
      endpoint: process.env.IDS_EXTERNAL_API_RC,
      reg_no: vehicle_number,
      params: { reg_no: vehicle_number },
      success: false,
      status_code: err?.response?.status ?? null,
      response_time_ms: Date.now() - t0,
    });
    throw err; // preserve original behaviour — caller handles the error
  }
  // 🚫 When challan is re-enabled, log it too:
  //    logExternalApiCall({ api_name: "CHALLAN", endpoint: ..._CHALLAN, reg_no, params: { reg_no }, ... })
  const challan = null; // challan API disabled

  // 🚫 FASTag API is DISABLED for now — fastag stays null so all downstream
  //    fastag handling is a no-op.
  // const vehicleClass =
  //   rc?.data?.data?.class ||
  //   rc?.data?.data?.vehicle_class ||
  //   rc?.data?.data?.data?.class ||
  //   rc?.data?.data?.data?.vehicle_class ||
  //   "";
  //
  // const fastag = shouldSkipFastagLookup(vehicleClass)
  //   ? null
  //   : await axios.post(process.env.IDS_EXTERNAL_API_FASTAG, {
  //       api_id: process.env.APIID,
  //       api_key: process.env.IDS_API_KEY,
  //       token_id: process.env.TOKEN_ID,
  //       vehicle_num: vehicle_number,
  //     });
  const fastag = null; // FASTag API disabled

  return { rc, challan, fastag };
}

/**
 * Insert a brand-new vehicle (RC + challans + violations + fastag) for a user,
 * using the caller's transaction `client` so the writes are part of the same
 * atomic transaction (and the same advisory-locked section).
 *
 * Pass `prefetched` (from fetchVehicleExternalDetails) to skip the network I/O
 * while the transaction is open. If omitted, the details are fetched inline
 * (kept for backwards-compatible callers, but prefer prefetching).
 *
 * @param {import('pg').PoolClient} client  the open transaction client
 * @param {number} fk_users        owning user id
 * @param {string} vehicle_number  cleaned registration plate
 * @param {{rc:object,challan:object,fastag:object}} [prefetched] external details
 * @returns the inserted rc_details row (id, reg_no, manufacturer, model, ...)
 */
async function insertNewVehicle(client, fk_users, vehicle_number, prefetched) {
  const { rc, challan, fastag } =
    prefetched || (await fetchVehicleExternalDetails(vehicle_number));

  const { myqueryrc, valuesrc } = getRCInsertQuery(fk_users, rc?.data?.data);
  const result_rc = await client.query(myqueryrc, valuesrc);
  const rcId = result_rc.rows[0].id;

  // 🚫 Challan API disabled — challan insertion skipped (challan is null).
  // const count = challan?.data?.data?.echallan_count || 0;
  // for (let i = 0; i < count; i++) {
  //   const item = challan.data.data.data[i];
  //   const { myquerych, valuesch } = getChallanInsertQuery(rcId, item);
  //   // challan_no is globally unique; an already-stored challan must not abort
  //   // the whole flow. Skip duplicates (and their violations) gracefully.
  //   const query = myquerych.replace(
  //     /\s*returning/i,
  //     " ON CONFLICT (challan_no) DO NOTHING returning",
  //   );
  //   const tempchallan = await client.query(query, valuesch);
  //   if (tempchallan.rows.length === 0) continue; // duplicate challan_no — skipped
  //   for (let j = 0; j < (item.violation_details?.length || 0); j++) {
  //     await client.query(
  //       `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3)`,
  //       [
  //         tempchallan.rows[0].id,
  //         item.violation_details[j].offence,
  //         item.violation_details[j].penalty,
  //       ],
  //     );
  //   }
  // }

  // 🚫 FASTag API disabled — fastag insertion skipped (fastag is null).
  // const fastagData = fastag?.data?.data?.data?.data;
  // if (fastagData) {
  //   const { myqueryft, valuesft } = getFastagInsertQuery(rcId, fastagData);
  //   await client.query(myqueryft, valuesft);
  // }
  return result_rc.rows[0];
}

module.exports = insertNewVehicle;
module.exports.fetchVehicleExternalDetails = fetchVehicleExternalDetails;
