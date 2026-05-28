const express = require("express");
const path = require("path");
const fs = require("fs");
const getQueryTypes = require("../repos/gets/getQueryTypes");
const getFeedbacks = require("../repos/gets/getFeedbacks");
const validateForMobileNumber = require("../validators/validateForMobileNumber");
const validateForFeedback = require("../validators/validateForFeedback");
const validateForContactMe = require("../validators/validateForContactMe");
const getGSTValue = require("../repos/gets/getGSTValue");
const verifyOtpForLogin = require('../repos/insertions/verifyOtpForLogin')
const postFeedback = require("../repos/insertions/postFeedback");
const postContactMe = require("../repos/insertions/postContactMe");
const getRequestDetails = require("../utils/getRequestDetails");
const { sendMail } = require("../comms/sendMail");
const userVisitLandingPageAlertTemplate = require("../comms/userVisitLandingPageAlertTemplate");
const getStatesAndUnions = require("../repos/gets/getStatesAndUnions");
const validateForVerifyOtpLogin = require("../validators/validateForVerifyOtpLogin");
const getUserMasterDetails = require("../repos/gets/getUserMasterDetails");

const publicRotuer = express.Router();
publicRotuer.get("/query-types", async (req, res) => {
  try {
    const result = await getQueryTypes();
    let { ipAddress, visitTime, devicename, result_ipdetails } =
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
publicRotuer.post(
  "/feedback",
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
publicRotuer.post("/contact-me", async (req, res) => {
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
publicRotuer.post(
  "/send-otp",  
  async (req, res) => {
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
      result = await sendOtpForPurchaseHistory(result.data.mobile_number);
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

publicRotuer.post(
  "/verify-otp",  
  async (req, res) => {
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
      if(result.successstatus){
        //get details of vehicle & user subscriptions
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
  },
);
publicRotuer.get("/user-dashboard", async (req, res) => {
  try {
    const result = await getUserMasterDetails();
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
module.exports = publicRotuer;
