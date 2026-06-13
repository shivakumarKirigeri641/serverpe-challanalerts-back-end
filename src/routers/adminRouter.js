const express = require("express");
const path = require("path");
const fs = require("fs");

const resources = require("../config/adminResources");
const getInvoicePath = require("../repos/gets/getInvoicePath");
const crudRepo = require("../repos/admin/crudRepo");
const adminAuth = require("../repos/admin/adminAuth");
const getDashboardStats = require("../repos/admin/getDashboardStats");
const getRevenueDetails = require("../repos/admin/getRevenueDetails");
const getDashboardOverview = require("../repos/admin/getDashboardOverview");
const getAnalytics = require("../repos/admin/getAnalytics");
const getRecentActivity = require("../repos/admin/getRecentActivity");
const wallet = require("../repos/admin/wallet");
const bulk = require("../repos/admin/bulkOnboard");
const authMiddleware = require("../middlewares/authMiddleware");
const { strictLimiter } = require("../utils/rateLimiters");
const { respond, serverError } = require("../utils/respond");
const { DEFAULT_TTL_SECONDS } = require("../utils/adminToken");

const adminRouter = express.Router();

/* =========================================================================
   AUTH  (public — no session required)
   ========================================================================= */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: DEFAULT_TTL_SECONDS * 1000,
  path: "/",
};

adminRouter.post("/auth/login/send-otp", strictLimiter, async (req, res) => {
  try {
    const result = await adminAuth.sendOtp(req.body?.mobile_number);
    return respond(res, result);
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.post("/auth/login/verify-otp", strictLimiter, async (req, res) => {
  try {
    const result = await adminAuth.verifyOtp(
      req.body?.mobile_number,
      req.body?.otp,
    );
    if (result.successstatus && result.data?.token) {
      res.cookie("admin_token", result.data.token, cookieOptions);
    }
    return respond(res, result);
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.post("/auth/logout", (req, res) => {
  res.clearCookie("admin_token", { ...cookieOptions, maxAge: undefined });
  return respond(res, {
    statuscode: 200,
    successstatus: true,
    message: "Logged out successfully",
  });
});

/* =========================================================================
   Everything below requires a valid admin session.
   ========================================================================= */
adminRouter.use(authMiddleware);

adminRouter.get("/auth/me", (req, res) =>
  respond(res, {
    statuscode: 200,
    successstatus: true,
    message: "Authenticated",
    data: { role: req.admin.role, mobile_number: req.admin.mobile_number },
  }),
);

adminRouter.get("/dashboard/stats", async (req, res) => {
  try {
    return respond(res, await getDashboardStats());
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.get("/dashboard/revenue", async (req, res) => {
  try {
    return respond(res, await getRevenueDetails());
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.get("/dashboard/overview", async (req, res) => {
  try {
    return respond(res, await getDashboardOverview());
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.get("/analytics", async (req, res) => {
  try {
    return respond(res, await getAnalytics());
  } catch (err) {
    return respond(res, serverError(err));
  }
});

/* Recharge the provider wallets — adds to the existing balance. */
adminRouter.post("/wallet/recharge", async (req, res) => {
  try {
    return respond(res, await wallet.rechargeWallet(req.body?.amount));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.post("/wallet/sms/recharge", async (req, res) => {
  try {
    return respond(res, await wallet.rechargeSmsWallet(req.body?.amount));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

/* Live activity feed — poll with ?after=<last id> for near-real-time updates. */
adminRouter.get("/activity/recent", async (req, res) => {
  try {
    return respond(
      res,
      await getRecentActivity({ after: req.query.after, limit: req.query.limit }),
    );
  } catch (err) {
    return respond(res, serverError(err));
  }
});

/* ── Bulk onboarding: one user (OTP-verified) → many vehicles → invoice ── */
adminRouter.post("/bulk/send-otp", async (req, res) => {
  try {
    return respond(res, await bulk.bulkSendOtp(req.body?.mobile_number));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.post("/bulk/create-user", async (req, res) => {
  try {
    return respond(res, await bulk.bulkCreateUser(req.body || {}));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.post("/bulk/add-vehicle", async (req, res) => {
  try {
    return respond(res, await bulk.bulkAddVehicle(req.body || {}));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.post("/bulk/remove-vehicle", async (req, res) => {
  try {
    return respond(res, await bulk.bulkRemoveVehicle(req.body || {}));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.get("/bulk/summary", async (req, res) => {
  try {
    return respond(res, await bulk.bulkSummary(req.query?.fk_users));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.post("/bulk/create-order", async (req, res) => {
  try {
    return respond(res, await bulk.bulkCreateOrder(req.body || {}));
  } catch (err) {
    return respond(res, serverError(err));
  }
});
adminRouter.post("/bulk/verify-payment", async (req, res) => {
  try {
    return respond(res, await bulk.bulkVerifyPayment(req.body || {}));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

/* Stream a generated GST invoice PDF for viewing/download in the console.
   Authenticated (this route is after authMiddleware). The PDF is binary so it
   bypasses the JSON crypto wrapper. */
adminRouter.get("/invoices/:invoice_id/file", async (req, res) => {
  try {
    const result = await getInvoicePath(req.params.invoice_id);
    if (!result.successstatus) {
      return respond(res, result);
    }
    const absPath = path.join(__dirname, "..", result.data.invoice_path);
    if (!fs.existsSync(absPath)) {
      return respond(res, {
        statuscode: 404,
        successstatus: false,
        message: "Invoice file not found on server",
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.data.invoice_id}.pdf"`,
    );
    return res.sendFile(absPath);
  } catch (err) {
    return respond(res, serverError(err));
  }
});

/* List every available resource slug (drives the frontend menu). */
adminRouter.get("/resources", (req, res) =>
  respond(res, {
    statuscode: 200,
    successstatus: true,
    message: "Resources fetched successfully",
    data: Object.keys(resources).map((route) => ({
      route,
      table: resources[route].table,
      label: resources[route].label || resources[route].table,
      group: resources[route].group || "Other",
      readonly: !!resources[route].readonly,
    })),
  }),
);

/* =========================================================================
   Generic CRUD — one set of routes per configured resource.
     GET    /resources/:resource           list (page,limit,search,is_active,order)
     GET    /resources/:resource/meta      column metadata for form rendering
     GET    /resources/:resource/:id       get one
     POST   /resources/:resource           create
     PUT    /resources/:resource/:id        update
     PATCH  /resources/:resource/:id        update (partial)
     DELETE /resources/:resource/:id        soft delete (?mode=hard for hard delete)
   ========================================================================= */

// Resolve & validate the :resource param once for every CRUD route.
const withResource = (req, res, next) => {
  const cfg = resources[req.params.resource];
  if (!cfg) {
    return respond(res, {
      statuscode: 404,
      successstatus: false,
      message: `Unknown resource '${req.params.resource}'`,
    });
  }
  req.resourceCfg = cfg;
  next();
};

// Block writes on read-only resources.
const writable = (req, res, next) => {
  if (req.resourceCfg.readonly) {
    return respond(res, {
      statuscode: 405,
      successstatus: false,
      message: `'${req.params.resource}' is read-only`,
    });
  }
  next();
};

const base = "/resources/:resource";

adminRouter.get(base, withResource, async (req, res) => {
  try {
    return respond(res, await crudRepo.list(req.resourceCfg, req.query));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.get(`${base}/meta`, withResource, async (req, res) => {
  try {
    return respond(res, await crudRepo.getColumns(req.resourceCfg));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

// {id,label} pairs for FK dropdowns: GET /resources/:resource/options?label=col
adminRouter.get(`${base}/options`, withResource, async (req, res) => {
  try {
    return respond(
      res,
      await crudRepo.options(req.resourceCfg, req.query.label),
    );
  } catch (err) {
    return respond(res, serverError(err));
  }
});

// Nested children: list child rows of a parent row by the declared FK.
//   GET /resources/:resource/:id/children/:child
adminRouter.get(
  `${base}/:id/children/:child`,
  withResource,
  async (req, res) => {
    try {
      const relation = (req.resourceCfg.children || []).find(
        (c) => c.resource === req.params.child,
      );
      if (!relation) {
        return respond(res, {
          statuscode: 404,
          successstatus: false,
          message: `'${req.params.child}' is not a child of '${req.params.resource}'`,
        });
      }
      const childCfg = resources[relation.resource];
      return respond(
        res,
        await crudRepo.listByForeignKey(
          childCfg,
          relation.fk,
          req.params.id,
          req.query,
        ),
      );
    } catch (err) {
      return respond(res, serverError(err));
    }
  },
);

adminRouter.get(`${base}/:id`, withResource, async (req, res) => {
  try {
    return respond(res, await crudRepo.getById(req.resourceCfg, req.params.id));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

adminRouter.post(base, withResource, writable, async (req, res) => {
  try {
    return respond(res, await crudRepo.create(req.resourceCfg, req.body));
  } catch (err) {
    return respond(res, serverError(err));
  }
});

const updateHandler = async (req, res) => {
  try {
    return respond(
      res,
      await crudRepo.update(req.resourceCfg, req.params.id, req.body),
    );
  } catch (err) {
    return respond(res, serverError(err));
  }
};
adminRouter.put(`${base}/:id`, withResource, writable, updateHandler);
adminRouter.patch(`${base}/:id`, withResource, writable, updateHandler);

adminRouter.delete(`${base}/:id`, withResource, writable, async (req, res) => {
  try {
    const mode = req.query.mode === "hard" ? "hard" : "soft";
    return respond(
      res,
      await crudRepo.remove(req.resourceCfg, req.params.id, mode),
    );
  } catch (err) {
    return respond(res, serverError(err));
  }
});

module.exports = adminRouter;
