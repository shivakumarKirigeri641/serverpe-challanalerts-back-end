const { sendWhatsApp } = require("./sendWhatsApp");
const sendWelcomeSMS = require("./sendWelcomeSMS");
const recordSend = require("./recordSend");

/**
 * Welcome message on subscription. Uses the common WhatsApp sender with the
 * approved "amv_welcome_v1" template (body params: user name, vehicle number,
 * trial expiry date). If WhatsApp fails, the common sender invokes the SMS
 * fallback passed here, so a new subscriber always gets a confirmation.
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
  const res = await sendWhatsApp({
    mobile_number,
    template: "amv_welcome_v1",
    params: [user_name, vehicle_number, expiry_date],
    onSmsFallback: () =>
      sendWelcomeSMS(pool, vehicle_number, mobile_number, expiry_date),
  });
  recordSend({ mobile_number, channel: "WHATSAPP", sent: !!res?.ok, kind: "WELCOME" });
  return res;
};

module.exports = sendWelcomeWhatsApp;
