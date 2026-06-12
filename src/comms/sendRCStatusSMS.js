const axios = require("axios");
const recordSend = require("./recordSend");
require("dotenv").config();
const sendRCStatusSMS = async (
  pool,
  mobile_number,
  vehicle_number,
  rc_date_of_expiry,
) => {
  let sent = false;
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217221&variables_values=${vehicle_number}|${rc_date_of_expiry}&numbers=${mobile_number}`,
    );
    sent = true;
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", err.response?.data || err.message);
    throw err;
  } finally {
    recordSend({ mobile_number, channel: "SMS", sent, kind: "RC_STATUS" });
  }
};
module.exports = sendRCStatusSMS;
