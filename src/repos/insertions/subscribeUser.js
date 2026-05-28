const { connectDB } = require("../../database/connectDB");
const getChallan = require("../../temp/getChallan");
const getFastag = require("../../temp/getFastag");
const getRC = require("../../temp/getRC");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const getFastagInsertQuery = require("../../utils/getFastagInsertQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const pool = connectDB();
const subscribeUser = async (user_name, mobile_number, vehicle_number) => {
  try {
    await pool.query(`BEGIN`);
    const result = await pool.query(
      `insert into users(user_name, mobile_number) values ($1,$2) returning *;`,
      [user_name, mobile_number],
    );
    if (0 === result.rows.length) {
      return {
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Failed to insert user. Error:${err.message}`,
      };
    }
    //insert rc
    //call external api for rc_details
    const data = getRC(vehicle_number, result.rows[0].id);
    let { myqueryrc, valuesrc } = getRCInsertQuery(data);
    const result_rc = await pool.query(myqueryrc, valuesrc);

    //not working
    const challan = getChallan(result_rc.rows[0].id);
    let result_challans = [];
    for (let i = 0; i < challan.length; i++) {
      let { myquerych, valuesch } = getChallanInsertQuery(challan[i]);
      let tempchallan = await pool.query(myquerych, valuesch);
      result_challans.push(tempchallan.rows[0]);
    }

    let fastag = getFastag(result_rc.rows[0].id);
    let { myqueryft, valuesft } = getFastagInsertQuery(fastag);
    const result_fastag = await pool.query(myqueryft, valuesft);

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
        fastag_details: result_fastag.rows[0],
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
module.exports = subscribeUser;
