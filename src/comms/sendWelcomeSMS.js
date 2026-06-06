const axios = require("axios");
require("dotenv").config();
const sendWelcomeSMS = async (
  pool,
  vehicle_number,
  mobile_number,
  trail_subscription_date,
) => {
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217224&variables_values=${vehicle_number}|${trail_subscription_date}&numbers=${mobile_number}`,
    );
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", error.response?.data || error.message);
    throw error;
  }
};
module.exports = sendWelcomeSMS;
