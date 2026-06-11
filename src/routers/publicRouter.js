const express = require("express");
const getStatesUnions = require("../repo/gets/getStatesUnions");
const publicRouter = express.Router();
publicRouter.get("/states-unions", async (req, res) => {
  try {
    const result = await getStatesUnions();
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
module.exports = publicRouter;
