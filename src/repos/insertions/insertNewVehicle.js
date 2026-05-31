const axios = require("axios");
const { connectDB } = require("../../database/connectDB");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const getFastagInsertQuery = require("../../utils/getFastagInsertQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const pool = connectDB();

/**
 * Insert a brand-new vehicle (RC + challans + violations + fastag) for a user.
 *
 * Fetches the RC / challan / fastag details from the external IDS APIs and
 * persists them in one go. Shared by the renewal and replace-vehicle flows, so
 * it assumes the caller has already opened a transaction (BEGIN).
 *
 * @param {number} fk_users        owning user id
 * @param {string} vehicle_number  cleaned registration plate
 * @returns the inserted rc_details row (id, reg_no, manufacturer, model, ...)
 */
async function insertNewVehicle(fk_users, vehicle_number) {
  const rc_external_details = await axios.post(
    process.env.IDS_EXTERNAL_API_RC,
    {
      api_id: process.env.APIID,
      api_key: process.env.IDS_API_KEY,
      token_id: process.env.TOKEN_ID,
      reg_no: vehicle_number,
    },
  );
  const challan_external_details = await axios.post(
    process.env.IDS_EXTERNAL_API_CHALLAN,
    {
      api_id: process.env.APIID,
      api_key: process.env.IDS_API_KEY,
      token_id: process.env.TOKEN_ID,
      reg_no: vehicle_number,
    },
  );
  const fastag_external_details = await axios.post(
    process.env.IDS_EXTERNAL_API_FASTAG,
    {
      api_id: process.env.APIID,
      api_key: process.env.IDS_API_KEY,
      token_id: process.env.TOKEN_ID,
      vehicle_num: vehicle_number,
    },
  );
  const rc = rc_external_details;
  const challan = challan_external_details;
  const fastag = fastag_external_details;
  const { myqueryrc, valuesrc } = getRCInsertQuery(fk_users, rc?.data?.data);
  const result_rc = await pool.query(myqueryrc, valuesrc);
  const rcId = result_rc.rows[0].id;

  const count = challan?.data?.data?.echallan_count || 0;
  for (let i = 0; i < count; i++) {
    const item = challan.data.data.data[i];
    const { myquerych, valuesch } = getChallanInsertQuery(rcId, item);
    // challan_no is globally unique; an already-stored challan must not abort
    // the whole flow. Skip duplicates (and their violations) gracefully.
    const query = myquerych.replace(
      /\s*returning/i,
      " ON CONFLICT (challan_no) DO NOTHING returning",
    );
    const tempchallan = await pool.query(query, valuesch);
    if (tempchallan.rows.length === 0) continue; // duplicate challan_no — skipped
    for (let j = 0; j < (item.violation_details?.length || 0); j++) {
      await pool.query(
        `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3)`,
        [
          tempchallan.rows[0].id,
          item.violation_details[j].offence,
          item.violation_details[j].penalty,
        ],
      );
    }
  }

  const fastagData = fastag?.data?.data?.data?.data;
  if (fastagData) {
    const { myqueryft, valuesft } = getFastagInsertQuery(rcId, fastagData);
    await pool.query(myqueryft, valuesft);
  }
  return result_rc.rows[0];
}

module.exports = insertNewVehicle;
