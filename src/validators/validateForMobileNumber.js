const validateForMobileNumber = (req) => {
  try {
    const mobile_number =
      req?.body?.mobile_number ||
      req?.query?.mobile_number ||
      req?.headers?.mobile_number;

    if (!mobile_number) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "mobile_number is required",
        data: null,
      };
    }

    // Normalize
    const cleaned = mobile_number
      .toString()
      .replace(/\s+/g, "")
      .replace(/^(\+91|91)/, "");

    // Validate
    const mobileRegex = /^[6-9]\d{9}$/;

    if (!mobileRegex.test(cleaned)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid mobile number format",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Mobile number validated successfully",
      data: {
        mobile_number: cleaned,
      },
    };
  } catch (error) {
    console.error("Mobile validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForMobileNumber;
