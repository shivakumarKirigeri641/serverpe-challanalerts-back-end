const express = require("express");
const path = require("path");
const fs = require("fs");
const feedbackUpload = require("../utils/feedbackUpload");
const { strictLimiter } = require("../utils/rateLimiters");
const createRenewOrder = require("../repos/insertions/createRenewOrder");
const verifyRenewPayment = require("../repos/insertions/verifyRenewPayment");
const getInvoicePath = require("../repos/gets/getInvoicePath");
const validateForRenew = require("../validators/validateForRenew");
const validateForReplace = require("../validators/validateForReplace");
const getReplacementPlans = require("../repos/gets/getReplacementPlans");
const createReplaceVehicleOrder = require("../repos/insertions/createReplaceVehicleOrder");
const verifyReplaceVehiclePayment = require("../repos/insertions/verifyReplaceVehiclePayment");
const getQueryTypes = require("../repos/gets/getQueryTypes");
const getPlans = require("../repos/gets/getPlans");
const getFeedbacks = require("../repos/gets/getFeedbacks");
const validateForMobileNumber = require("../validators/validateForMobileNumber");
const validateForFeedback = require("../validators/validateForFeedback");
const validateForContactMe = require("../validators/validateForContactMe");
const getGSTValue = require("../repos/gets/getGSTValue");
const verifyOtpForLogin = require("../repos/insertions/verifyOtpForLogin");
const postFeedback = require("../repos/insertions/postFeedback");
const postContactMe = require("../repos/insertions/postContactMe");
const getRequestDetails = require("../utils/getRequestDetails");
const { sendMail } = require("../comms/sendMail");
const userVisitLandingPageAlertTemplate = require("../comms/userVisitLandingPageAlertTemplate");
const getStatesAndUnions = require("../repos/gets/getStatesAndUnions");
const validateForVerifyOtpLogin = require("../validators/validateForVerifyOtpLogin");
const getUserMasterDetails = require("../repos/gets/getUserMasterDetails");
const validateForMobileNumberForSubscription = require("../validators/validateForMobileNumberForSubscription");
const checkIfVehicleExists = require("../repos/checks/checkIfVehicleExists");
const checkIfMobileNumberAlreadySubscribed = require("../repos/checks/checkIfMobileNumberAlreadySubscribed");
const ccheckIfMobileNumberForDashboard = require("../repos/checks/checkIfMobileNumberForDashboard");
const subscribeUser = require("../repos/insertions/subscribeUser");
const insertOtpForSubscription = require("../repos/insertions/insertOtpForSubscription");
const subscribeUser_local = require("../repos/insertions/subscribeUser_local");
const getTerms = require("../repos/gets/getTerms");
const getPrivacyPolicy = require("../repos/gets/getPrivacyPolicy");
const getConsentPolicy = require("../repos/gets/getConsentPolicy");
const getRefundPolicy = require("../repos/gets/getRefundPolicy");
const getLiabilitiesPolicy = require("../repos/gets/getLiabilitiesPolicy");
const getExchangeVehicleNumberPolicy = require("../repos/gets/getExchangeVehicleNumberPolicy");
const validateForVerifyOtpDashboard = require("../validators/validateForVerifyOtpDashboard");
const checkIfMobileNumberForDashboard = require("../repos/checks/checkIfMobileNumberForDashboard");
const { generateOTP } = require("../utils/generateOTP");

const publicRotuer = express.Router();
publicRotuer.get("/query-types", async (req, res) => {
  try {
    /*let { ipAddress, visitTime, devicename, result_ipdetails } =
      await getRequestDetails(req);
    await sendMail({
      to: process.env.ADMINMAIL,
      subject: "An user landing page visit alert",
      html: userVisitLandingPageAlertTemplate({
        ipAddress,
        visitTime,
        devicename,
        result_ipdetails,
      }),
      text: "Alert! User visited landing page",
    });*/
    const result = await getQueryTypes();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/gst-value", async (req, res) => {
  try {
    const result = await getGSTValue();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/feedbacks", async (req, res) => {
  try {
    const result = await getFeedbacks();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/subscription-plans-withtrail", async (req, res) => {
  try {
    const result = await getPlans();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/subscription-plans", async (req, res) => {
  try {
    const result = await getPlans(false);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/replace-vehicle-plans", async (req, res) => {
  try {
    const result = await getReplacementPlans();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.post(
  "/feedback",
  strictLimiter,
  (req, res, next) => {
    feedbackUpload.single("pic")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          statuscode: 400,
          powered_by: "ServerPe App Solutions",
          successstatus: false,
          message: err.message || "Image upload failed",
        });
      }
      next();
    });
  },
  async (req, res) => {
    const cleanupUploadedFile = () => {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
    };
    try {
      const validation = validateForFeedback(req);
      if (false === validation.successstatus) {
        cleanupUploadedFile();
        return res.status(validation.statuscode).json({
          statuscode: validation.statuscode,
          powered_by: "ServerPe App Solutions",
          successstatus: validation.successstatus,
          message: validation.message,
        });
      }
      const picPath = req.file
        ? `uploads/feedback_pics/${req.file.filename}`
        : null;
      const result = await postFeedback(
        req.body.user_name,
        Number(req.body.rating),
        req.body.message || null,
        picPath,
      );
      if (!result.successstatus) cleanupUploadedFile();
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    } catch (err) {
      cleanupUploadedFile();
      return res.status(500).json({
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Internal server error. Error:${err.message}`,
      });
    }
  },
);
publicRotuer.post("/contact-me", strictLimiter, async (req, res) => {
  try {
    const validation = validateForContactMe(req);
    if (false === validation.successstatus) {
      return res.status(validation.statuscode).json({
        statuscode: validation.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: validation.successstatus,
        message: validation.message,
      });
    }
    const result = await postContactMe(
      req.body.user_name,
      req.body.mobile_number,
      req.body.query_type_name,
      req.body.message,
      req.body.email,
    );
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});
publicRotuer.get("/states-unions", async (req, res) => {
  try {
    const result = await getStatesAndUnions();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/agreements/terms", async (req, res) => {
  try {
    const result = await getTerms();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/agreements/privacy-policy", async (req, res) => {
  try {
    const result = await getPrivacyPolicy();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/agreements/consent-policy", async (req, res) => {
  try {
    const result = await getConsentPolicy();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/agreements/refund-policy", async (req, res) => {
  try {
    const result = await getRefundPolicy();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get("/agreements/liabilities-policy", async (req, res) => {
  try {
    const result = await getLiabilitiesPolicy();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRotuer.get(
  "/agreements/exchange-vehicle-number-policy",
  async (req, res) => {
    try {
      const result = await getExchangeVehicleNumberPolicy();
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    } catch (err) {
      return res.status(500).json({
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Internal server error. Error:${err.message}`,
      });
    } finally {
    }
  },
);
publicRotuer.post("/dashboard/send-otp", strictLimiter, async (req, res) => {
  try {
    let result = validateForMobileNumber(req);
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    }
    //store an OTP so /dashboard/verify-otp can validate it
    result = await checkIfMobileNumberForDashboard(req?.body?.mobile_number);
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
      });
    }
    let otp = generateOTP();
    result = await insertOtpForSubscription(req?.body?.mobile_number, otp);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});

publicRotuer.post("/dashboard/verify-otp", strictLimiter, async (req, res) => {
  try {
    const mobileResult = validateForVerifyOtpDashboard(req);
    if (false === mobileResult.successstatus) {
      return res.status(mobileResult.statuscode).json({
        statuscode: mobileResult.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: mobileResult.successstatus,
        message: mobileResult.message,
        data: mobileResult.data,
      });
    }
    result = await verifyOtpForLogin(
      mobileResult.data.mobile_number,
      mobileResult.data.otp,
    );
    if (result.successstatus) {
      //get details of vehicle & user subscriptions
      result = await getUserMasterDetails(mobileResult?.data?.mobile_number);
    }
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});
publicRotuer.post("/subscribe/send-otp", strictLimiter, async (req, res) => {
  try {
    let result = validateForMobileNumberForSubscription(req);
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    }
    // Canonical (normalized) plate from the validator — used for the existence
    // check so KA01AB1 / KA01AB0001 resolve to the same stored vehicle.
    const cleanedVehicle = result.data.vehicle_number;
    //check if vehicle mobile exists
    result = await checkIfMobileNumberAlreadySubscribed(
      req?.body?.mobile_number,
    );
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
      });
    }
    //check if vehicle already exists
    result = await checkIfVehicleExists(cleanedVehicle);
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
      });
    }
    let otp = generateOTP();
    result = await insertOtpForSubscription(req.body.mobile_number, otp);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});
publicRotuer.post("/subscribe/verify-otp", strictLimiter, async (req, res) => {
  try {
    const mobileResult = validateForVerifyOtpLogin(req);
    if (false === mobileResult.successstatus) {
      return res.status(mobileResult.statuscode).json({
        statuscode: mobileResult.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: mobileResult.successstatus,
        message: mobileResult.message,
        data: mobileResult.data,
      });
    }
    result = await verifyOtpForLogin(
      mobileResult.data.mobile_number,
      mobileResult.data.otp,
    );
    if (true === result.successstatus) {
      //subscribe teh vehicle and activate the free trail
      //result = await subscribeUser(
      result = await subscribeUser_local(
        mobileResult.data.user_name,
        mobileResult.data.mobile_number,
        mobileResult.data.vehicle_number,
        mobileResult.data.fk_states_unions,
      );
    }
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});

/* -------------------------- renewal / payment ---------------------------- */

// Create a Razorpay order for renewing a paid plan for one or more vehicles.
publicRotuer.post("/renew/create-order", strictLimiter, async (req, res) => {
  try {
    const validation = validateForRenew(req);
    if (false === validation.successstatus) {
      return res.status(validation.statuscode).json({
        statuscode: validation.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: validation.successstatus,
        message: validation.message,
        data: validation.data,
      });
    }
    const result = await createRenewOrder(
      validation.data.fk_subscription_plans,
      validation.data.vehicle_numbers,
    );
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});

// Verify a Razorpay payment, activate the subscription, persist payment+invoice.
publicRotuer.post("/renew/verify-payment", strictLimiter, async (req, res) => {
  try {
    const validation = validateForRenew(req);
    if (false === validation.successstatus) {
      return res.status(validation.statuscode).json({
        statuscode: validation.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: validation.successstatus,
        message: validation.message,
        data: validation.data,
      });
    }
    const {
      mobile_number,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};
    if (
      !mobile_number ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        statuscode: 400,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message:
          "mobile_number and razorpay_order_id/payment_id/signature are required",
      });
    }
    const cleanedMobile = String(mobile_number)
      .replace(/\s+/g, "")
      .replace(/^(\+91|91)/, "");
    const result = await verifyRenewPayment({
      mobile_number: cleanedMobile,
      fk_subscription_plans: validation.data.fk_subscription_plans,
      vehicle_numbers: validation.data.vehicle_numbers,
      remove_vehicle_numbers: validation.data.remove_vehicle_numbers,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});

/* ----------------------- replace vehicle / payment ----------------------- */

// Create a Razorpay order for replacing a vehicle on an active subscription.
publicRotuer.post(
  "/replace-vehicle/create-order",
  strictLimiter,
  async (req, res) => {
    try {
      const validation = validateForReplace(req);
      if (false === validation.successstatus) {
        return res.status(validation.statuscode).json({
          statuscode: validation.statuscode,
          powered_by: "ServerPe App Solutions",
          successstatus: validation.successstatus,
          message: validation.message,
          data: validation.data,
        });
      }
      const cleanedMobile = String(req?.body?.mobile_number || "")
        .replace(/\s+/g, "")
        .replace(/^(\+91|91)/, "");
      if (!cleanedMobile) {
        return res.status(400).json({
          statuscode: 400,
          powered_by: "ServerPe App Solutions",
          successstatus: false,
          message: "mobile_number is required",
        });
      }
      const result = await createReplaceVehicleOrder(
        cleanedMobile,
        validation.data.fk_replacement_plan,
        validation.data.old_vehicle_number,
        validation.data.new_vehicle_number,
      );
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    } catch (err) {
      return res.status(500).json({
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Internal server error. Error:${err.message}`,
      });
    }
  },
);

// Verify a Razorpay payment, swap the vehicle, record it, persist payment+invoice.
publicRotuer.post(
  "/replace-vehicle/verify-payment",
  strictLimiter,
  async (req, res) => {
    try {
      const validation = validateForReplace(req);
      if (false === validation.successstatus) {
        return res.status(validation.statuscode).json({
          statuscode: validation.statuscode,
          powered_by: "ServerPe App Solutions",
          successstatus: validation.successstatus,
          message: validation.message,
          data: validation.data,
        });
      }
      const {
        mobile_number,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};
      if (
        !mobile_number ||
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          statuscode: 400,
          powered_by: "ServerPe App Solutions",
          successstatus: false,
          message:
            "mobile_number and razorpay_order_id/payment_id/signature are required",
        });
      }
      const cleanedMobile = String(mobile_number)
        .replace(/\s+/g, "")
        .replace(/^(\+91|91)/, "");
      const result = await verifyReplaceVehiclePayment({
        mobile_number: cleanedMobile,
        fk_replacement_plan: validation.data.fk_replacement_plan,
        old_vehicle_number: validation.data.old_vehicle_number,
        new_vehicle_number: validation.data.new_vehicle_number,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
        data: result.data,
      });
    } catch (err) {
      return res.status(500).json({
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `Internal server error. Error:${err.message}`,
      });
    }
  },
);

// Download a generated GST invoice PDF.
publicRotuer.get("/invoice/:invoice_id", async (req, res) => {
  try {
    const result = await getInvoicePath(req.params.invoice_id);
    if (false === result.successstatus) {
      return res.status(result.statuscode).json({
        statuscode: result.statuscode,
        powered_by: "ServerPe App Solutions",
        successstatus: result.successstatus,
        message: result.message,
      });
    }
    const absPath = path.join(__dirname, "..", result.data.invoice_path);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({
        statuscode: 404,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: "Invoice file not found",
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.data.invoice_id}.pdf"`,
    );
    return res.sendFile(absPath);
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  }
});
module.exports = publicRotuer;
