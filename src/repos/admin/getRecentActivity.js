const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Live admin activity feed. Reads api_logs (which records EVERY public request
 * — subscribes, logins, payments, page views) and turns recent rows into
 * human-readable events. The admin console polls this with the last-seen id
 * (`after`) so it shows new activity in near-real-time while you're logged in.
 *
 * @param {object} p { after?: number (return events with id > after), limit?: number }
 * @returns {Promise<{statuscode, successstatus, message, data:{ events:[], latest_id:number }}>}
 */

/* Friendly names for the SPA pages the /track beacon reports (by pathname). */
const PAGE_NAMES = {
  "/": "Landing page",
  "/subscribe": "Subscribe page",
  "/dashboard": "Dashboard page",
  "/feedback": "Feedback page",
  "/terms": "Terms page",
  "/privacy": "Privacy page",
  "/consent-policy": "Consent policy",
  "/refund-policy": "Refund policy",
  "/liabilities-policy": "Liabilities policy",
  "/exchange-vehicle-policy": "Exchange-vehicle policy",
};
const pageName = (p) => PAGE_NAMES[p] || (p ? `page ${p}` : "a page");

/** Safely parse the api_logs.request_body column (jsonb→object, text→string). */
const parseBody = (rb) => {
  if (!rb) return null;
  if (typeof rb === "object") return rb;
  try {
    return JSON.parse(rb);
  } catch {
    return null;
  }
};

/** Map a request endpoint + status (+ body) to a friendly activity label. */
const describe = (endpoint = "", status, body = null) => {
  const e = String(endpoint).toLowerCase();
  const ok = status && status < 400;
  // Explicit page-view beacon → "Viewed <page>".
  if (e.endsWith("/track") || e.includes("/track?"))
    return { type: "visit", label: `Viewed ${pageName(body?.page)}` };
  if (e.includes("subscribe/verify-otp"))
    return { type: "subscribe", label: ok ? "New subscription" : "Subscription attempt failed" };
  if (e.includes("subscribe/send-otp"))
    return { type: "subscribe", label: "Subscribe — OTP requested" };
  if (e.includes("dashboard/verify-otp"))
    return { type: "login", label: ok ? "Dashboard login" : "Login attempt failed" };
  if (e.includes("dashboard/send-otp"))
    return { type: "login", label: "Dashboard — OTP requested" };
  if (e.includes("renew/verify-payment"))
    return { type: "payment", label: ok ? "Renewal payment ✓" : "Renewal payment failed" };
  if (e.includes("renew/create-order"))
    return { type: "payment", label: "Renewal — order created" };
  if (e.includes("replace-vehicle/verify-payment"))
    return { type: "payment", label: ok ? "Vehicle replaced ✓" : "Replace payment failed" };
  if (e.includes("replace-vehicle/create-order"))
    return { type: "payment", label: "Vehicle replace — order created" };
  if (e.includes("/feedback")) return { type: "feedback", label: "Feedback submitted" };
  if (e.includes("/contact-me")) return { type: "contact", label: "Contact message" };
  if (e.includes("vehicles-subscribed-count"))
    return { type: "visit", label: "Landing page view" };
  if (
    e.includes("subscription-plans") ||
    e.includes("states-unions") ||
    e.includes("query-types") ||
    e.includes("gst-value") ||
    e.includes("agreements")
  )
    return { type: "visit", label: "Browsing site" };
  if (e.includes("invoice")) return { type: "invoice", label: "Invoice viewed" };
  return { type: "other", label: e.replace(/^.*\/public\//, "") || "Activity" };
};

const getRecentActivity = async ({ after = 0, limit = 30 } = {}) => {
  try {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const afterId = parseInt(after, 10) || 0;
    const result = await pool.query(
      `select id, method, endpoint, mobile_number, vehicle_number,
              status_code, device_info, ip_address, request_body, created_at
         from api_logs
        where id > $1
        order by id desc
        limit $2`,
      [afterId, lim],
    );
    const events = result.rows.map((r) => {
      const d = describe(r.endpoint, r.status_code, parseBody(r.request_body));
      return {
        id: Number(r.id),
        type: d.type,
        label: d.label,
        method: r.method,
        endpoint: r.endpoint,
        mobile_number: r.mobile_number,
        vehicle_number: r.vehicle_number,
        status_code: r.status_code,
        ok: !!(r.status_code && r.status_code < 400),
        device: r.device_info,
        ip: r.ip_address,
        at: r.created_at,
      };
    });
    return {
      statuscode: 200,
      successstatus: true,
      message: "Recent activity fetched",
      data: { events, latest_id: events[0]?.id || afterId },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching recent activity. Error: ${err.message}`,
    };
  }
};

module.exports = getRecentActivity;
