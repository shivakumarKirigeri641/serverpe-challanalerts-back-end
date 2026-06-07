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
  let client;
  try {
    const rc_external_details = getRC(vehicle_number);
    const challan_external_details = getChallan(vehicle_number);
    const fastag_external_details = getFastag(vehicle_number);

    // Dedicated connection + per-mobile advisory lock, same as subscribeUser.
    client = await pool.connect();
    await client.query(`BEGIN`);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      mobile_number,
    ]);
    const result = await client.query(
      `insert into users(user_name, mobile_number, fk_states_unions) values ($1,$2,$3)
       on conflict (mobile_number) do nothing returning *;`,
      [user_name, mobile_number, fk_states_unions],
    );
    if (0 === result.rows.length) {
      await client.query(`ROLLBACK`);
      return {
        statuscode: 409,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `User already subscribed in platform!`,
      };
    }
    let { myqueryrc, valuesrc } = getRCInsertQuery(
      result.rows[0].id,
      rc_external_details?.data?.data,
    );
    const result_rc = await client.query(myqueryrc, valuesrc);
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
      let tempchallan = await client.query(myquerych, valuesch);
      //insert violations
      let violation_details_array = [];
      for (
        let j = 0;
        j <
        challan_external_details?.data?.data?.data[i].violation_details?.length;
        j++
      ) {
        const violations = await client.query(
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
      result_fastag = await client.query(myqueryft, valuesft);
    }
    //insert into user_subscribed
    let subscription_plans = await client.query(
      `select *from subscription_plans where price=0`,
    );
    let result_subscribed_details = await client.query(
      `insert into user_subscribed (fk_users, fk_subscription_plans, active_on, expires_on, expiry_days) values ($1,$2,now(),
    now() + interval '5 minutes', ((now() + interval '5 minutes')::date - CURRENT_DATE)) returning *`,
      [result.rows[0].id, subscription_plans.rows[0].id],
    );
    await client.query(`COMMIT`);
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
        subscription_plan: subscription_plans.rows[0],
        // Same shape as getUserMasterDetails' subscription_list: plan fields
        // merged with this subscription's active_on / expires_on / is_active.
        subscription_list: [
          {
            ...subscription_plans.rows[0],
            active_on: result_subscribed_details.rows[0].active_on,
            expires_on: result_subscribed_details.rows[0].expires_on,
            is_active: result_subscribed_details.rows[0].is_active,
          },
        ],
      },
    };
  } catch (err) {
    if (client) {
      try {
        await client.query(`ROLLBACK`);
      } catch (_) {
        /* connection may be broken; release() below discards it */
      }
    }
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed in subscription. Error:${err.message}`,
    };
  } finally {
    if (client) client.release();
  }
};
module.exports = subscribeUser_local;
