const axios = require("axios");
const recordSend = require("./recordSend");
require("dotenv").config();
const sendOtpSMS = async (pool, mobile_number, otp, valid_mins = 3) => {
  let sent = false;
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217222&variables_values=${otp}|${valid_mins}&numbers=${mobile_number}`,
    );
    sent = true;
    console.log("SMS sent successfully:", response.data);
  } catch (err) {
    console.error("SMS sending failed:", err.response?.data || err.message);
    throw err;
  } finally {
    recordSend({ mobile_number, channel: "SMS", sent, kind: "OTP" });
  }
};
module.exports = sendOtpSMS;
