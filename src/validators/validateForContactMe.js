const validateForContactMe = (req) => {
  const { user_name, mobile_number, query_type_name, email, message } =
    req.body || {};

  if (
    !user_name ||
    typeof user_name !== "string" ||
    user_name.trim().length === 0
  ) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "user_name is required",
    };
  }
  if (user_name.length > 150) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "user_name should be less than 150 characters",
    };
  }

  if (!mobile_number || !/^[6-9]\d{9}$/.test(String(mobile_number))) {
    return {
      statuscode: 400,
      successstatus: false,
      message:
        "mobile_number is required and must be a valid 10-digit Indian number starting 6-9",
    };
  }

  if (
    !query_type_name ||
    typeof query_type_name !== "string" ||
    query_type_name.trim().length === 0
  ) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "query_type_name is required",
    };
  }
  if (query_type_name.length > 150) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "query_type_name should be less than 150 characters",
    };
  }

  if (email !== undefined && email !== null && email !== "") {
    const emailStr = String(email).trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(emailStr) || emailStr.length > 255) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "email is not valid",
      };
    }
  }

  if (
    !message ||
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "message is required",
    };
  }
  if (message.length > 2000) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "message should be less than 2000 characters",
    };
  }

  return {
    statuscode: 200,
    successstatus: true,
    message: "Contact-me payload validated successfully",
  };
};
module.exports = validateForContactMe;
