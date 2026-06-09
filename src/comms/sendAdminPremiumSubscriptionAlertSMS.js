const axios = require("axios");
require("dotenv").config();
const sendAdminPremiumSubscriptionAlertSMS = async (
  pool,
  user_name,
  subscriptin_name,
  fees,
) => {
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217619&variables_values=${user_name}|${subscriptin_name}|${fees}&numbers=${process.env.MYOWNNUMBERPERSONAL}`,
    );
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", error.response?.data || error.message);
    throw error;
  }
};
module.exports = sendAdminPremiumSubscriptionAlertSMS;
