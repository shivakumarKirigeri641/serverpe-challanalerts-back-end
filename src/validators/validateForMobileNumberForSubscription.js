const { normalizePlate, isValidPlate } = require("../utils/normalizePlate");

const validateForMobileNumberForSubscription = (req) => {
  try {
    const mobile_number =
      req?.body?.mobile_number ||
      req?.query?.mobile_number ||
      req?.headers?.mobile_number;

    const vehicle_number =
      req?.body?.vehicle_number ||
      req?.query?.vehicle_number ||
      req?.headers?.vehicle_number;

    const user_name =
      req?.body?.user_name ||
      req?.query?.user_name ||
      req?.headers?.user_name;

    const fk_states_unions =
      req?.body?.fk_states_unions ||
      req?.query?.fk_states_unions ||
      req?.headers?.fk_states_unions;

    if (!mobile_number) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "mobile_number is required",
        data: null,
      };
    }

    const cleanedMobile = mobile_number
      .toString()
      .replace(/\s+/g, "")
      .replace(/^(\+91|91)/, "");

    const mobileRegex = /^[6-9]\d{9}$/;

    if (!mobileRegex.test(cleanedMobile)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid mobile number format",
        data: null,
      };
    }

    if (!vehicle_number) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "vehicle_number is required",
        data: null,
      };
    }

    // Modern (KA01AB1234 — number zero-padded to 4), BH (22BH1234AA) or older
    // (MYE368) plates. See utils/normalizePlate.
    if (!isValidPlate(vehicle_number)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid vehicle_number format",
        data: null,
      };
    }
    const cleanedVehicle = normalizePlate(vehicle_number);

    if (!user_name) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "user_name is required",
        data: null,
      };
    }

    const cleanedUserName = user_name.toString().trim().replace(/\s+/g, " ");

    const userNameRegex = /^[A-Za-z][A-Za-z\s.'-]{1,98}[A-Za-z.]$/;

    if (!userNameRegex.test(cleanedUserName)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message:
          "Invalid user_name format. Use 2-100 letters, spaces, dots, apostrophes or hyphens",
        data: null,
      };
    }

    if (
      fk_states_unions === undefined ||
      fk_states_unions === null ||
      String(fk_states_unions).trim() === ""
    ) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "fk_states_unions is required",
        data: null,
      };
    }

    const cleanedStateUnion = Number(fk_states_unions);
    if (!Number.isInteger(cleanedStateUnion) || cleanedStateUnion <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid fk_states_unions",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Subscription details validated successfully",
      data: {
        mobile_number: cleanedMobile,
        vehicle_number: cleanedVehicle,
        user_name: cleanedUserName,
        fk_states_unions: cleanedStateUnion,
      },
    };
  } catch (error) {
    console.error("Subscription validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForMobileNumberForSubscription;
