/**
 * Standard ServerPe response envelope used by every admin route.
 * Keeps the response shape identical to the public API so the frontend
 * can share parsing logic.
 */
const respond = (res, result) => {
  const statuscode = result?.statuscode || 500;
  return res.status(statuscode).json({
    statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result?.successstatus ?? false,
    message: result?.message || "",
    ...(result?.data !== undefined ? { data: result.data } : {}),
    ...(result?.meta !== undefined ? { meta: result.meta } : {}),
  });
};

/** Build a 500 result from a caught error. */
const serverError = (err) => ({
  statuscode: 500,
  successstatus: false,
  message: `Internal server error. Error:${err.message}`,
});

module.exports = { respond, serverError };
