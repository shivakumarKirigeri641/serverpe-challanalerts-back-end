const { connectDB } = require("../../database/connectDB");
const axios = require("axios");
const getChallan = require("../../temp/getChallan");
const getFastag = require("../../temp/getFastag");
const getRC = require("../../temp/getRC");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const getFastagInsertQuery = require("../../utils/getFastagInsertQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const pool = connectDB();
const subscribeUser_local = async (
  user_name,
  mobile_number,
  vehicle_number,
  fk_states_unions,
) => {
  try {
    await pool.query(`BEGIN`);
    const result = await pool.query(
      `insert into users(user_name, mobile_number, fk_states_unions) values ($1,$2,$3) returning *;`,
      [user_name, mobile_number, fk_states_unions],
    );
    if (0 === result.rows.length) {
      return {
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Failed to insert user. Error:${err.message}`,
      };
    }
    const rc_external_details = getRC(vehicle_number);
    const challan_external_details = getChallan(vehicle_number);
    const fastag_external_details = getFastag(vehicle_number);
    let { myqueryrc, valuesrc } = getRCInsertQuery(
      result.rows[0].id,
      rc_external_details?.data?.data,
    );
    const result_rc = await pool.query(myqueryrc, valuesrc);
    let result_challans = [];
    for (
      let i = 0;
      i < challan_external_details?.data?.data?.echallan_count;
      i++
    ) {
      let { myquerych, valuesch } = getChallanInsertQuery(
        result_rc.rows[0].id,
        challan_external_details?.data?.data?.data[i],
      );
      let tempchallan = await pool.query(myquerych, valuesch);
      //insert violations
      let violation_details_array = [];
      for (
        let j = 0;
        j <
        challan_external_details?.data?.data?.data[i].violation_details?.length;
        j++
      ) {
        const violations = await pool.query(
          `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3) returning *`,
          [
            tempchallan.rows[0].id,
            challan_external_details?.data?.data?.data[i].violation_details[j]
              .offence,
            challan_external_details?.data?.data?.data[i].violation_details[j]
              .penalty,
          ],
        );
        violation_details_array.push(violations.rows[0]);
      }
      result_challans.push({
        challan_data: tempchallan.rows[0],
        violataion_data: violation_details_array,
      });
    }
    //let fastag = getFastag(result_rc.rows[0].id);
    let result_fastag = null;
    if (fastag_external_details?.data?.data?.data?.data) {
      let { myqueryft, valuesft } = getFastagInsertQuery(
        result_rc.rows[0].id,
        fastag_external_details?.data?.data?.data?.data,
      );
      const result_fastag = await pool.query(myqueryft, valuesft);
    }
    await pool.query(`COMMIT`);
    //alert messages here

    return {
      statuscode: 200,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: `Subscription successful`,
      data: {
        user_details: result.rows[0],
        rc_details: result_rc.rows[0], //precaution, do not send all deatails, just for test only
        challan_details: result_challans,
        fastag_details: result_fastag ? result_fastag.rows[0] : null,
      },
    };
  } catch (err) {
    await pool.query(`ROLLBACK`);
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed in subscription. Error:${err.message}`,
    };
  }
};
module.exports = subscribeUser_local;
