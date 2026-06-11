const Razorpay = require("razorpay");
require("dotenv").config();

/**
 * Singleton Razorpay client built from RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 * In test mode use your test keys; the same code works in live mode.
 */
let instance = null;

const getRazorpay = () => {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
};

module.exports = { getRazorpay };
