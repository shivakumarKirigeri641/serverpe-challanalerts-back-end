const validateForFeedback = (req) => {
  const { user_name, rating, message } = req.body || {};

  if (!user_name || typeof user_name !== "string" || user_name.trim().length === 0) {
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

  const ratingNum = Number(rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "rating is required and must be between 1 and 5",
    };
  }

  if (message && String(message).length > 2000) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "message should be less than 2000 characters",
    };
  }

  return {
    statuscode: 200,
    successstatus: true,
    message: "Feedback payload validated successfully",
  };
};
module.exports = validateForFeedback;
