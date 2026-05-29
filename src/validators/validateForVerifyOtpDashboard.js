const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const validateForVerifyOtpDashboard = (req) => {
  try {
    const mobile_number = req?.body?.mobile_number;
    const otp = req?.body?.otp;

    if (!mobile_number) return err("mobile_number is required");
    if (!otp) return err("otp is required");

    const cleanedMobile = mobile_number
      .toString()
      .replace(/\s+/g, "")
      .replace(/^(\+91|91)/, "");
    if (!/^[6-9]\d{9}$/.test(cleanedMobile)) {
      return err("Invalid mobile number format");
    }

    const cleanedOtp = String(otp).trim();
    if (!/^\d{4}$/.test(cleanedOtp)) {
      return err("OTP must be 4 digits");
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Validation successful",
      data: {
        mobile_number: cleanedMobile,
        otp: cleanedOtp,
      },
    };
  } catch (error) {
    console.error("verify-otp-login validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForVerifyOtpDashboard;
