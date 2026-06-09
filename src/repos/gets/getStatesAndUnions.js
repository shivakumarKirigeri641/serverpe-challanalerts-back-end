const { sendWhatsApp } = require("../../comms/sendWhatsApp");
const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
const axios = require("axios");
require("dotenv").config();
const getStatesAndUnions = async () => {
  try {
    const result = await pool.query(
      `SELECT id, state_union_code, rto_code, state_union_name, is_union_territory from states_unions where
      is_active=true order by state_union_name;`,
    );
    //test whatsapp
    /*const response = await axios.post(    
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: `91900970271`,
        type: "template",
        template: {
          name: "amv_welcome_v1",
          language: {
            code: "en",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: `Amruta`,
                },
                {
                  type: "text",
                  text: `KA32R8604`,
                },
                {
                  type: "text",
                  text: `06-07-2026`,
                },
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("WhatsApp Sent:", response.data);

    const rcRow = await pool.query(
      `select * from rc_details where reg_no=$1 and fk_users=$2 limit 1`,
      ["KA04MZ3336", 2174],
    );
    const result_user = await pool.query(`select *from users where id=2174`);
    const user = result_user.rows[0];
    const vehicleRows = [];
    let vehicle_numbers = ["KA04MZ3336"];
    for (const vno of vehicle_numbers) {
      const existing = await pool.query(
        `select * from rc_details where reg_no=$1`,
        [vno],
      );

      if (existing.rows.length > 0) {
        vehicleRows.push(await getVehicleWithDetails(existing.rows[0]));
      }

      //send alert
    }
    const challanItems = [];
    const mobile_number = `9886122415`;
    if (rcRow.rows.length > 0) {
      const challanRes = await pool.query(
        `select * from challan_details where fk_rc_details=$1 order by created_at`,
        [rcRow.rows[0].id],
      );

      for (const challan of challanRes.rows) {
        const violationRes = await pool.query(
          `select * from violation_details where fk_challan_details=$1 order by created_at`,
          [challan.id],
        );

        challanItems.push({
          challan_overview: challan,
          violation_details: violationRes.rows,
        });
      }
    }

    if (challanItems.length > 0) {
      let i = 0;
      for (const item of challanItems) {
        const challan = item?.challan_overview || {};
        const violations = item?.violation_details || [];
        const status = challan.challan_status ? "Active" : "Inactive";

        if (violations.length > 0) {
          // One WhatsApp per violation — its own offence/penalty, not joined.
          for (const violation of violations) {
            await sendWhatsApp({
              mobile_number,
              template: "amv_challan_v1",
              params: [
                user.user_name,
                vehicleRows[i].reg_no,
                challan.challan_no,
                violation.penalty,
                challan.challan_location,
                status,
                violation.offence,
              ],
            });
          }
          i++;
        } else {
          // Challan with no violation rows — use the challan-level fields.
          await sendWhatsApp({
            mobile_number,
            template: "amv_challan_v1",
            params: [
              user.user_name,
              vehicleRows[i].reg_no,
              challan.challan_no,
              challan.penalty,
              challan.challan_location,
              status,
              challan.offence,
            ],
          });
        }
      }
    } else {
      await sendWhatsApp({
        mobile_number,
        template: "amv_no_challan_v1",
        params: [user.user_name, vehicleRows[i].reg_no],
      });
    }*/
    return {
      statuscode: 200,
      successstatus: true,
      message: "States/unions fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching offers. Error: ${err.message}`,
    };
  }
};
const getVehicleWithDetails = async (rcRow) => {
  const fastagRes = await pool.query(
    `select * from fastag_details where fk_rc_details=$1 order by created_at desc limit 1`,
    [rcRow.id],
  );

  const challanOverviewRes = await pool.query(
    `select * from challan_details where fk_rc_details=$1 order by created_at`,
    [rcRow.id],
  );

  const challan_details = [];
  for (const challan of challanOverviewRes.rows) {
    const violationRes = await pool.query(
      `select * from violation_details where fk_challan_details=$1 order by created_at`,
      [challan.id],
    );

    challan_details.push({
      challan_overview: challan,
      violation_details: violationRes.rows,
    });
  }

  return {
    ...rcRow,
    fastag_details: fastagRes.rows[0] ?? null,
    challan_details,
  };
};
module.exports = getStatesAndUnions;
