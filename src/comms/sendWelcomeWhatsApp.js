const { sendWhatsAppTemplate, toWhatsAppNumber } = require("./sendWhatsApp");
const sendWelcomeSMS = require("./sendWelcomeSMS");

/**
 * Welcome message on subscription. Sends the approved "amv_welcome_v1" WhatsApp
 * template (body params: user name, vehicle number, trial expiry date) and, if
 * the WhatsApp send fails, falls back to the existing fast2sms welcome SMS so a
 * new subscriber is never left without a confirmation.
 *
 * @param {import('pg').Pool} pool
 * @param {string} user_name
 * @param {string} vehicle_number
 * @param {string} mobile_number    cleaned 10-digit
 * @param {string} expiry_date      YYYY-MM-DD
 */
const sendWelcomeWhatsApp = async (
  pool,
  user_name,
  vehicle_number,
  mobile_number,
  expiry_date,
) => {
  try {
    await sendWhatsAppTemplate(toWhatsAppNumber(mobile_number), "amv_welcome_v1", [
      user_name,
      vehicle_number,
      expiry_date,
    ]);
  } catch (err) {
    console.error(
      "Welcome WhatsApp failed, falling back to SMS:",
      err?.response?.data || err.message,
    );
    // Fallback so the subscriber still gets a confirmation.
    await sendWelcomeSMS(pool, vehicle_number, mobile_number, expiry_date);
  }
};

module.exports = sendWelcomeWhatsApp;
