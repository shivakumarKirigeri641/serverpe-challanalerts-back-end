const axios = require("axios");
const recordSend = require("./recordSend");
require("dotenv").config();
const sendAdminTrailSubscriptionAlertSMS = async (user_name, vehicle_number) => {
  let sent = false;
  try {
    const response = await axios.get(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMSAPIKEY}&route=dlt&sender_id=SRVRPE&message=217618&variables_values=${user_name}|${vehicle_number}&numbers=${process.env.MYOWNNUMBERPERSONAL}`,
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
      kind: "ADMIN_TRIAL",
    });
  }
};
module.exports = sendAdminTrailSubscriptionAlertSMS;
