const { connectDB } = require("../../database/connectDB");
const { fetchVehicleExternalDetails } = require("./insertNewVehicle");
const sendWelcomeWhatsApp = require("../../comms/sendWelcomeWhatsApp");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const sendAdminTrailSubscriptionAlertSMS = require("../../comms/sendAdminTrailSubscriptionAlertSMS");
const getFastagInsertQuery = require("../../utils/getFastagInsertQuery");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const sendWelcomeSMS = require("../../comms/sendWelcomeSMS");
const sendRCStatusSMS = require("../../comms/sendRCStatusSMS");
const sendVDHReportToWhatsapp = require("../../comms/sendVDHReportToWhatsapp");
const pool = connectDB();

const subscribeUser = async (
  user_name,
  mobile_number,
  vehicle_number,
  fk_states_unions,
) => {
  let client;
  try {
    // 1) External lookups FIRST — never hold a pooled DB connection open across
    //    these slow HTTP round-trips (that's what exhausts the pool under load).
    const {
      rc: rc_external_details,
      challan: challan_external_details,
      fastag: fastag_external_details,
    } = await fetchVehicleExternalDetails(vehicle_number);

    // 2) One dedicated connection for the whole transaction. Using pool.query()
    //    for BEGIN/…/COMMIT would scatter the statements across different
    //    connections and break atomicity under concurrency.
    client = await pool.connect();
    await client.query(`BEGIN`);

    // 3) Serialize concurrent subscribes for THIS mobile number only. Other
    //    users across India are unaffected — this is a per-key lock, not a table
    //    lock — and it's released automatically on COMMIT/ROLLBACK.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      mobile_number,
    ]);

    // 4) Insert the user. The unique constraint on mobile_number + ON CONFLICT
    //    makes a duplicate subscribe a no-op instead of a second account.
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
    const userId = result.rows[0].id;

    let { myqueryrc, valuesrc } = getRCInsertQuery(
      userId,
      rc_external_details?.data?.data,
    );
    const result_rc = await client.query(myqueryrc, valuesrc);
    const rcId = result_rc.rows[0].id;

    let result_challans = [];
    for (
      let i = 0;
      i < challan_external_details?.data?.data?.echallan_count;
      i++
    ) {
      const item = challan_external_details?.data?.data?.data[i];
      let { myquerych, valuesch } = getChallanInsertQuery(rcId, item);
      // challan_no is globally unique; skip an already-stored challan instead of
      // aborting the whole subscription.
      const query = myquerych.replace(
        /\s*returning/i,
        " ON CONFLICT (challan_no) DO NOTHING returning",
      );
      let tempchallan = await client.query(query, valuesch);
      if (tempchallan.rows.length === 0) continue; // duplicate challan_no — skipped
      //insert violations
      let violation_details_array = [];
      for (let j = 0; j < (item.violation_details?.length || 0); j++) {
        const violations = await client.query(
          `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3) returning *`,
          [
            tempchallan.rows[0].id,
            item.violation_details[j].offence,
            item.violation_details[j].penalty,
          ],
        );
        violation_details_array.push(violations.rows[0]);
      }
      result_challans.push({
        challan_data: tempchallan.rows[0],
        violataion_data: violation_details_array,
      });
    }

    let result_fastag = null;
    if (fastag_external_details?.data?.data?.data?.data) {
      let { myqueryft, valuesft } = getFastagInsertQuery(
        rcId,
        fastag_external_details?.data?.data?.data?.data,
      );
      // assign to the outer variable (the previous `const` here shadowed it, so
      // the fastag row never made it into the response).
      result_fastag = await client.query(myqueryft, valuesft);
    }
    //insert into user_subscribed — the free trial plan (is_trial), activated for
    //its configured validity_days (e.g. 28).
    let subscription_plans = await client.query(
      `select *from subscription_plans where is_active=true and is_trial=true order by price asc limit 1`,
    );
    const trialPlan = subscription_plans.rows[0];
    let result_subscribed_details = await client.query(
      `insert into user_subscribed (fk_users, fk_subscription_plans, active_on, expires_on, expiry_days)
       values ($1,$2, now(), now() + ($3 || ' days')::interval,
               ((now() + ($3 || ' days')::interval)::date - CURRENT_DATE)) returning *`,
      [userId, trialPlan.id, String(trialPlan.validity_days)],
    );
    await client.query(`COMMIT`);
    //alert here to user & as well as for admin
    //alert messages here

    //1. send welcome sms
    /*const subscriptin_expiry_date = result_subscribed_details.rows[0].expires_on
      .toISOString()
      .split("T")[0];
    await sendWelcomeSMS(
      pool,
      vehicle_number,
      mobile_number,
      subscriptin_expiry_date,
    );*/

    //send RC expiry sms
    /*const rc_expiry_date = new Date(result_rc.rows[0].rc_expiry_date);
    dateOnly = new Date(
      rc_expiry_date.getFullYear(),
      rc_expiry_date.getMonth(),
      rc_expiry_date.getDate(),
    );
    await sendRCStatusSMS(
      pool,
      mobile_number,
      vehicle_number,
      result_rc.rows[0].rc_expiry_date,
    );*/
    await sendWelcomeWhatsApp(
      pool,
      result.rows[0].user_name,
      vehicle_number,
      mobile_number,
      result_subscribed_details.rows[0].expires_on.toISOString().split("T")[0],
    );
    await sendVDHReportToWhatsapp(
      pool,
      result.rows[0].user_name,
      vehicle_number,
      result_rc.rows[0].rc_expiry_date,
      result_rc.rows[0].vehicle_insurance_upto,
      result_rc.rows[0].pucc_upto,
      result_fastag ? result_fastag.rows[0].balance : "N/A",
      `N/A for trial subscription.`,
      mobile_number,
    );
    await sendAdminTrailSubscriptionAlertSMS(
      result.rows[0].user_name,
      vehicle_number,
    );
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
module.exports = subscribeUser;
