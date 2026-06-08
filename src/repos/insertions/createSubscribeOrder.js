const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const pool = connectDB();

/**
 * Creates a Razorpay order for a brand-new subscription (the paid trial).
 *
 * The trial plan is resolved SERVER-SIDE (the active plan flagged is_trial) — we
 * never trust a client-supplied plan id for the onboarding charge. The plan
 * price is GST-inclusive and covers a single vehicle, so the payable amount is
 * simply the plan price.
 *
 * @param {string} mobile_number   cleaned 10-digit mobile
 * @param {string} vehicle_number  cleaned registration plate
 */
const createSubscribeOrder = async (mobile_number, vehicle_number) => {
  try {
    const planRes = await pool.query(
      `select * from subscription_plans where is_active=true and is_trial=true order by price asc limit 1`,
    );
    if (planRes.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: "No active trial plan is configured",
      };
    }
    const plan = planRes.rows[0];

    if (Number(plan.price) <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "Trial plan is not priced yet; cannot create an order",
      };
    }

    const amountInr = Number(plan.price); // GST-inclusive
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = getRazorpay();
    const receipt = `sub_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        plan_code: plan.plan_code,
        plan_name: plan.plan_name,
        mobile_number,
        vehicle_number,
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

module.exports = createSubscribeOrder;
