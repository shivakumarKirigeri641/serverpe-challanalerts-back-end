const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const pool = connectDB();

/**
 * Creates a Razorpay order for replacing a vehicle on an active subscription.
 *
 * The replacement fee is a GST-inclusive flat amount from replacement_plan, so
 * the payable amount is simply the plan price. Returns the order plus the plan
 * and the plates so the UI can show its summary.
 *
 * @param {string} mobile_number        cleaned subscriber mobile (active, paid)
 * @param {number} fk_replacement_plan  chosen replacement offer id (price>0)
 * @param {string} old_vehicle_number   plate being swapped out
 * @param {string} new_vehicle_number   plate being swapped in
 */
const createReplaceVehicleOrder = async (
  mobile_number,
  fk_replacement_plan,
  old_vehicle_number,
  new_vehicle_number,
) => {
  try {
    // Replacement is a paid-plan benefit — the user must have an active PAID
    // subscription. Block trial (price=0) users before any payment is taken.
    const subRes = await pool.query(
      `select sp.price as plan_price
         from user_subscribed us
         join subscription_plans sp on sp.id = us.fk_subscription_plans
         join users u on u.id = us.fk_users
        where u.mobile_number=$1 and u.is_active=true and us.is_active=true
        order by us.id desc limit 1`,
      [mobile_number],
    );
    if (subRes.rows.length === 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "No active subscription to replace a vehicle on",
      };
    }
    if (Number(subRes.rows[0].plan_price) <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message:
          "Vehicle replacement isn't available on the free trial. Please upgrade to a paid plan first.",
      };
    }

    const planRes = await pool.query(
      `select * from replacement_plan where id=$1 and is_active=true`,
      [fk_replacement_plan],
    );
    if (planRes.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "Replacement plan not found",
      };
    }
    const plan = planRes.rows[0];

    if (Number(plan.price) <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "Invalid replacement plan",
      };
    }

    const amountInr = Number(plan.price); // GST-inclusive
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = getRazorpay();
    const receipt = `rpl_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        plan_code: plan.plan_code,
        plan_name: plan.plan_name,
        old_vehicle_number,
        new_vehicle_number,
      },
    });

    return {
      statuscode: 200,
      successstatus: true,
      message: "Order created successfully",
      data: {
        order_id: order.id,
        amount: order.amount, // paise
        currency: order.currency,
        receipt: order.receipt,
        key_id: process.env.RAZORPAY_KEY_ID, // public key for checkout.js
        plan,
        old_vehicle_number,
        new_vehicle_number,
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to create order. Error: ${err?.error?.description || err.message}`,
    };
  }
};

module.exports = createReplaceVehicleOrder;
