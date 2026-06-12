const axios = require("axios");
const recordSend = require("./recordSend");
require("dotenv").config();
const sendAdminPremiumSubscriptionAlertSMS = async (
  user_name,
  subscriptin_name,
  fees,
) => {
  let sent = false;
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217619&variables_values=${user_name}|${subscriptin_name}|${fees}&numbers=${process.env.MYOWNNUMBERPERSONAL}`,
    );
    sent = true;
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", err.response?.data || err.message);
    throw err;
  } finally {
    recordSend({
      mobile_number: process.env.MYOWNNUMBERPERSONAL,
      channel: "SMS",
      sent,
      kind: "ADMIN_PREMIUM",
    });
  }
};
module.exports = sendAdminPremiumSubscriptionAlertSMS;
