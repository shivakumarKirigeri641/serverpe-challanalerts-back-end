const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const getUserMasterDetails = async (mobile_number) => {
  try {
    //user-details
    const result_user = await pool.query(
      `select *from users where mobile_number=$1 and is_active=true`,
      [mobile_number],
    );
    if (0 === result_user.rows.length) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "User not found",
      };
    }
    //rc
    let vehicle_subscriptoin_details = [];
    const result_rc = await pool.query(
      `select *from rc_details where fk_users=$1 order by created_at`,
      [result_user.rows[0].id],
    );
    if (0 === result_user.rows.length) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "RC dd not found",
      };
    }
    for (let i = 0; i < result_rc.rows.length; i++) {
      const result_challans = await pool.query(
        `select *from challan_details where fk_rc_details=$1 order by created_at`,
        [result_rc.rows[i].id],
      );
      const result_fastag_details = await pool.query(
        `select *from fastag_details where fk_rc_details=$1 order by created_at`,
        [result_rc.rows[i].id],
      );
      const result_subscribed_details = await pool.query(
        `select sp.*, us.active_on, us.expires_on, us.is_active 
          from user_subscribed us join subscription_plans sp on sp.id = us.fksubscription_plans where fk_rc_details=$1 order by us.created_at`,
        [result_rc.rows[i].id],
      );
      vehicle_subscriptoin_details.push({
        rc_details: result_challans.rows[i],
        challan_list:
          result_challans.rows.length > 0 ? result_challans.rows : [],
        fastag_details:
          result_fastag_details.rows.length > 0 ? result_challans.rows[0] : [],
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
