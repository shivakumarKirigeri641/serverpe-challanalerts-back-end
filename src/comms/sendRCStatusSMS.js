const axios = require("axios");
require("dotenv").config();
const sendRCStatusSMS = async (
  pool,
  mobile_number,
  vehicle_number,
  rc_date_of_expiry,
) => {
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217221&variables_values=${vehicle_number}|${rc_date_of_expiry}&numbers=s${mobile_number}`,
    );
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", error.response?.data || error.message);
    throw error;
  }
};
module.exports = sendRCStatusSMS;
