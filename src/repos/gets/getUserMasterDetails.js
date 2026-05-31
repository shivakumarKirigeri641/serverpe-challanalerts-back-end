const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getUserMasterDetails = async (mobile_number) => {
  try {
    //user-details
    const result_user = await pool.query(
      `select u.id as id, u.user_name, u.mobile_number, su.state_union_name, su.state_union_code, su.rto_code, su.country_name from users u
       join states_unions su on su.id = u.fk_states_unions where u.mobile_number=$1 and u.is_active=true`,
      [mobile_number],
    );
    if (0 === result_user.rows.length) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "User not found",
      };
    }
    //rc — one entry per vehicle the user owns
    let vehicle_subscriptoin_details = [];
    const result_rc = await pool.query(
      // coalesce keeps pre-migration rows (no is_active column value) visible;
      // a replaced vehicle is retired by setting is_active=false.
      `select id, reg_no, vehicle_manufacturer_name, model, fuel_type, vehicle_colour, vehicle_class, vehicle_insurance_upto, permit_valid_from, permit_valid_upto, national_permit_upto, pucc_upto from rc_details where fk_users=$1 and coalesce(is_active, true)=true order by created_at`,
      [result_user.rows[0].id],
    );

    // The subscription is per-account (one row covers all vehicles under the
    // plan's limit). Fetch it once and attach to every vehicle entry.
    const result_subscribed_details = await pool.query(
      `select sp.*, us.id as user_subscribed_id, us.active_on, us.expires_on, us.is_active,
              inv.invoice_id
          from user_subscribed us
          join subscription_plans sp on sp.id = us.fk_subscription_plans
          join users u on u.id = us.fk_users
          left join invoices inv on inv.fk_user_subscribed = us.id
          where u.mobile_number =$1 order by us.id desc`,
      [mobile_number],
    );

    for (let i = 0; i < result_rc.rows.length; i++) {
      const rc = result_rc.rows[i];

      // challans (with violations) for THIS vehicle
      const result_challans_overview = await pool.query(
        `select id, challan_no, challan_date, offence, penalty, challan_location, challan_amount, rto_name, is_active from challan_details where fk_rc_details=$1 order by created_at`,
        [rc.id],
      );
      const challan_data = [];
      for (let j = 0; j < result_challans_overview.rows.length; j++) {
        const result_violoation_details = await pool.query(
          `select *from violation_details where fk_challan_details=$1 order by created_at`,
          [result_challans_overview.rows[j].id],
        );
        challan_data.push({
          challan_overview: result_challans_overview.rows[j],
          violation_details: result_violoation_details.rows,
        });
      }

      // fastag for THIS vehicle
      const result_fastag_details = await pool.query(
        `select *from fastag_details where fk_rc_details=$1 order by created_at`,
        [rc.id],
      );

      vehicle_subscriptoin_details.push({
        rc_details: rc,
        challan_list: challan_data,
        fastag_details:
          result_fastag_details.rows.length > 0
            ? result_fastag_details.rows[0]
            : null,
        subscription_list: result_subscribed_details.rows,
      });
    }

    return {
      statuscode: 200,
      successstatus: true,
      message: "User master details fetched successfully",
      data: { user_details: result_user.rows[0], vehicle_subscriptoin_details },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching user details. Error: ${err.message}`,
    };
  }
};

module.exports = getUserMasterDetails;
