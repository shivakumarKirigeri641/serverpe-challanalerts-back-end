const axios = require("axios");
require("dotenv").config();
const sendFeedbackAlertSMS = async (pool, user_name, rating, message) => {
  try {
    let cutmessage = String(message ?? "").trim();
    if (cutmessage.length >= 29) {
      cutmessage = cutmessage.slice(0, 29);
    }
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217618&variables_values=${user_name}|${rating}|${cutmessage}&numbers=${process.env.MYOWNNUMBERPERSONAL}`,
    );
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", err?.response?.data || err?.message);
    throw err;
  }
};
module.exports = sendFeedbackAlertSMS;
