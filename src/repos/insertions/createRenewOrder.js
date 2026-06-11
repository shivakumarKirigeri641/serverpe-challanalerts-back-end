const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const pool = connectDB();

/**
 * Creates a Razorpay order for renewing a (paid) plan.
 *
 * The plan price is GST-inclusive and covers up to `vehicle_limit` vehicles, so
 * the payable amount is simply the plan price. Returns the order plus a small
 * pricing breakup the UI can show in its summary.
 *
 * @param {number} fk_subscription_plans  chosen plan id (must be paid: price>0)
 * @param {string[]} vehicle_numbers       cleaned plates the user wants covered
 */
const createRenewOrder = async (fk_subscription_plans, vehicle_numbers) => {
  try {
    const planRes = await pool.query(
      `select * from subscription_plans where id=$1 and is_active=true`,
      [fk_subscription_plans],
    );
    if (planRes.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "Plan not found",
      };
    }
    const plan = planRes.rows[0];

    if (Number(plan.price) <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "The free trial plan cannot be purchased",
      };
    }

    if (vehicle_numbers.length > plan.vehicle_limit) {
      return {
        statuscode: 400,
        successstatus: false,
        message: `This plan covers up to ${plan.vehicle_limit} vehicle(s)`,
      };
    }

    const amountInr = Number(plan.price); // GST-inclusive
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = getRazorpay();
    const receipt = `rnw_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        plan_code: plan.plan_code,
        plan_name: plan.plan_name,
        vehicle_numbers: vehicle_numbers.join(","),
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
        vehicle_numbers,
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

module.exports = createRenewOrder;
