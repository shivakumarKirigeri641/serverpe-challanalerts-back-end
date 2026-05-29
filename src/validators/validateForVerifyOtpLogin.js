const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const validateForVerifyOtpLogin = (req) => {
  try {
    const mobile_number = req?.body?.mobile_number;
    const user_name = req?.body?.user_name;
    const otp = req?.body?.otp;
    const vehicle_number = req?.body?.vehicle_number;
    const fk_states_unions = req?.body?.fk_states_unions;

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

    if (!isNonEmptyString(user_name)) return err("user_name is required");
    const cleanedName = user_name.trim().replace(/\s+/g, " ");
    if (cleanedName.length < 2 || cleanedName.length > 80) {
      return err("user_name must be between 2 and 80 characters");
    }
    if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(cleanedName)) {
      return err("user_name contains invalid characters");
    }

    if (!isNonEmptyString(vehicle_number))
      return err("vehicle_number is required");
    const cleanedVehicle = vehicle_number
      .toString()
      .toUpperCase()
      .replace(/[\s-]+/g, "");
    if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(cleanedVehicle)) {
      return err("Invalid vehicle_number format");
    }

    if (
      fk_states_unions === undefined ||
      fk_states_unions === null ||
      String(fk_states_unions).trim() === ""
    ) {
      return err("fk_states_unions is required");
    }
    const cleanedStateUnion = Number(fk_states_unions);
    if (!Number.isInteger(cleanedStateUnion) || cleanedStateUnion <= 0) {
      return err("Invalid fk_states_unions");
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Validation successful",
      data: {
        mobile_number: cleanedMobile,
        otp: cleanedOtp,
        user_name: cleanedName,
        vehicle_number: cleanedVehicle,
        fk_states_unions: cleanedStateUnion,
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

module.exports = validateForVerifyOtpLogin;
