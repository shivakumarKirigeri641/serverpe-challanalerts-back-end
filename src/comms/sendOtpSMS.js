const axios = require("axios");
require("dotenv").config();
const sendOtpSMS = async (pool, mobile_number, otp, valid_mins = 3) => {
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217222&variables_values=${otp}|${valid_mins}&numbers=${mobile_number}`,
    );
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", error.response?.data || error.message);
    throw error;
  }
};
module.exports = sendOtpSMS;
