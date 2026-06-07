/**
 * Declarative CRUD configuration for every admin-managed table in the
 * serverpe_vehicledocalerts database.
 *
 * Each entry maps a URL slug → table definition consumed by the generic
 * crudRepo / adminRouter.
 *
 *  - group      : sidebar section the resource is listed under
 *  - label      : human-friendly title
 *  - table      : physical table name (writes always target this)
 *  - source     : optional joined SELECT (sub-query) used for READS only, so
 *                 lists/gets can show friendly labels (e.g. vehicle number)
 *                 instead of raw foreign-key ids
 *  - writable   : columns accepted from the request body (create/update)
 *  - search     : columns scanned by ?search= (ILIKE) — may be source columns
 *  - order      : default ORDER BY (admin lists default to id ASC otherwise)
 *  - display    : curated [{ key, label }] columns shown in the list grid
 *  - references : { fkColumn: { resource, labelField } } → renders a friendly
 *                 dropdown in the form instead of a raw id input
 *  - children   : [{ resource, label, fk }] nested grids
 *  - readonly   : list/get only (no create/update/delete)
 */

const c = (key, label) => ({ key, label });

const POLICY_COLUMNS = ["title", "description", "display_order", "is_active"];
const POLICY_DISPLAY = [
  c("id", "ID"),
  c("title", "Title"),
  c("description", "Description"),
  c("display_order", "Order"),
  c("is_active", "Active"),
];
const POLICY = (table, label) => ({
  group: "Agreements",
  label,
  table,
  writable: POLICY_COLUMNS,
  search: ["title", "description"],
  order: "display_order ASC, id ASC",
  display: POLICY_DISPLAY,
});

const resources = {
  /* ----------------------- master / catalog tables ----------------------- */
  "subscription-plans": {
    group: "Catalog",
    label: "Subscription Plans",
    table: "subscription_plans",
    writable: [
      "plan_name",
      "plan_code",
      "price",
      "comparable_price",
      "vehicle_limit",
      "validity_days",
      "challan_checks_per_year",
      "rc_checks_per_year",
      "insurance_checks_per_year",
      "pucc_checks_per_year",
      "fastag_checks_per_year",
      "includes_monthly_report",
      "premium_support",
      "description",
      "is_active",
    ],
    search: ["plan_name", "plan_code"],
    order: "price ASC",
    display: [
      c("id", "ID"),
      c("plan_name", "Plan"),
      c("plan_code", "Code"),
      c("price", "Price (₹)"),
      c("comparable_price", "MRP (₹)"),
      c("vehicle_limit", "Vehicles"),
      c("validity_days", "Validity (days)"),
      c("is_active", "Active"),
    ],
  },
  "replacement-plans": {
    group: "Catalog",
    label: "Replacement Plans",
    table: "replacement_plan",
    writable: [
      "plan_name",
      "plan_code",
      "price",
      "comparable_price",
      "replacing_vehicles_count",
      "description",
      "is_active",
    ],
    search: ["plan_name", "plan_code"],
    order: "price ASC",
    display: [
      c("id", "ID"),
      c("plan_name", "Plan"),
      c("plan_code", "Code"),
      c("price", "Price (₹)"),
      c("replacing_vehicles_count", "Vehicles"),
      c("is_active", "Active"),
    ],
  },
  "states-unions": {
    group: "Catalog",
    label: "States & Unions",
    table: "states_unions",
    writable: [
      "state_union_name",
      "state_union_code",
      "rto_code",
      "country_name",
      "is_union_territory",
      "is_active",
    ],
    search: ["state_union_name", "state_union_code", "rto_code"],
    order: "state_union_name ASC",
    display: [
      c("id", "ID"),
      c("state_union_name", "State / Union"),
      c("state_union_code", "Code"),
      c("rto_code", "RTO Code"),
      c("country_name", "Country"),
      c("is_union_territory", "UT?"),
      c("is_active", "Active"),
    ],
  },
  "query-types": {
    group: "Catalog",
    label: "Query Types",
    table: "query_types",
    writable: ["code", "title", "description", "is_active"],
    search: ["code", "title"],
    order: "title ASC",
    display: [
      c("id", "ID"),
      c("code", "Code"),
      c("title", "Title"),
      c("description", "Description"),
      c("is_active", "Active"),
    ],
  },
  "gst-percents": {
    group: "Catalog",
    label: "GST Percents",
    table: "gst_percents",
    writable: ["gst_percent", "description", "is_active"],
    search: ["description"],
    order: "gst_percent ASC",
    display: [
      c("id", "ID"),
      c("gst_percent", "GST %"),
      c("description", "Description"),
      c("is_active", "Active"),
    ],
  },
  "gst-details": {
    group: "Catalog",
    label: "GST Details",
    table: "gst_details",
    source: `(
      SELECT g.*, su.state_union_name AS state_name
        FROM gst_details g
        LEFT JOIN states_unions su ON su.id = g.state_union_id
    ) AS gst_details`,
    writable: [
      "gst_number",
      "business_name",
      "legal_name",
      "gst_type",
      "pan_number",
      "state_union_id",
      "registered_address",
      "pincode",
      "contact_person",
      "contact_number",
      "email",
      "is_active",
    ],
    search: ["gst_number", "business_name", "legal_name", "pan_number"],
    order: "business_name ASC",
    references: {
      state_union_id: { resource: "states-unions", labelField: "state_union_name" },
    },
    display: [
      c("id", "ID"),
      c("gst_number", "GST No."),
      c("business_name", "Business"),
      c("legal_name", "Legal Name"),
      c("gst_type", "Type"),
      c("pan_number", "PAN"),
      c("state_name", "State"),
      c("contact_number", "Contact"),
      c("is_active", "Active"),
    ],
  },

  /* ----------------------------- content -------------------------------- */
  feedbacks: {
    group: "Customers",
    label: "Feedbacks",
    table: "feedbacks",
    writable: ["user_name", "rating", "message", "pic_path", "is_active"],
    search: ["user_name", "message"],
    order: "created_at DESC",
    display: [
      c("id", "ID"),
      c("user_name", "User"),
      c("rating", "Rating"),
      c("message", "Message"),
      c("is_active", "Active"),
      c("created_at", "Created"),
    ],
  },

  /* --------------------------- agreements ------------------------------- */
  "consent-policy": POLICY("consent_policy", "Consent Policy"),
  "privacy-policy": POLICY("privacy_policy", "Privacy Policy"),
  "terms-conditions": POLICY("terms_conditions", "Terms & Conditions"),
  "refund-policy": POLICY("refund_policy", "Refund Policy"),
  "liabilities-policy": POLICY("liabilities_policy", "Liabilities Policy"),
  "notification-policy": POLICY("notification_policy", "Notification Policy"),
  "exchange-vehicle-number-policy": POLICY(
    "exchange_vehicle_number_policy",
    "Exchange Vehicle Number Policy",
  ),

  /* ------------------------------ people -------------------------------- */
  users: {
    group: "Customers",
    label: "Users",
    table: "users",
    source: `(
      SELECT u.*, su.state_union_name AS state_name
        FROM users u
        LEFT JOIN states_unions su ON su.id = u.fk_states_unions
    ) AS users`,
    writable: [
      "user_name",
      "mobile_number",
      "fk_states_unions",
      "terms_accepted",
      "is_active",
    ],
    search: ["user_name", "mobile_number", "state_name"],
    order: "created_at DESC",
    references: {
      fk_states_unions: {
        resource: "states-unions",
        labelField: "state_union_name",
      },
    },
    display: [
      c("id", "ID"),
      c("user_name", "Name"),
      c("mobile_number", "Mobile"),
      c("state_name", "State / Union"),
      c("terms_accepted", "Terms?"),
      c("is_active", "Active"),
      c("created_at", "Created"),
    ],
  },
  "contact-me": {
    group: "Customers",
    label: "Contact Messages",
    table: "contact_me",
    source: `(
      SELECT cm.*, qt.title AS query_type
        FROM contact_me cm
        LEFT JOIN query_types qt ON qt.id = cm.fk_query_types
    ) AS contact_me`,
    writable: [
      "name",
      "mobile_number",
      "email",
      "subject",
      "message",
      "fk_query_types",
      "is_resolved",
      "is_active",
    ],
    search: ["name", "mobile_number", "email", "subject", "query_type"],
    order: "created_at DESC",
    references: {
      fk_query_types: { resource: "query-types", labelField: "title" },
    },
    display: [
      c("id", "ID"),
      c("name", "Name"),
      c("mobile_number", "Mobile"),
      c("email", "Email"),
      c("query_type", "Query Type"),
      c("subject", "Subject"),
      c("is_resolved", "Resolved?"),
      c("is_active", "Active"),
    ],
  },

  /* ---------------------- subscriptions / billing ----------------------- */
  "user-subscribed": {
    group: "Customers",
    label: "User Subscriptions",
    table: "user_subscribed",
    source: `(
      SELECT us.*,
             u.user_name,
             u.mobile_number,
             su.state_union_name AS state_name,
             sp.plan_name,
             sp.plan_code,
             sp.price AS plan_price
        FROM user_subscribed us
        LEFT JOIN users u            ON u.id  = us.fk_users
        LEFT JOIN states_unions su   ON su.id = u.fk_states_unions
        LEFT JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
    ) AS user_subscribed`,
    writable: [
      "fk_users",
      "fk_subscription_plans",
      "active_on",
      "expires_on",
      "is_active",
    ],
    search: ["user_name", "mobile_number", "plan_name"],
    order: "created_at DESC",
    references: {
      fk_users: { resource: "users", labelField: "user_name" },
      fk_subscription_plans: {
        resource: "subscription-plans",
        labelField: "plan_name",
      },
    },
    display: [
      c("id", "ID"),
      c("user_name", "Subscriber"),
      c("mobile_number", "Mobile"),
      c("plan_name", "Plan"),
      c("active_on", "Active On"),
      c("expires_on", "Expires On"),
      c("is_active", "Active"),
    ],
  },
  "user-replaced": {
    group: "Customers",
    label: "User Replacements",
    table: "user_replaced",
    source: `(
      SELECT ur.*,
             u.user_name,
             u.mobile_number,
             sp.plan_name,
             rin.reg_no  AS replacing_vehicle,
             red.reg_no  AS replaced_vehicle
        FROM user_replaced ur
        LEFT JOIN users u             ON u.id = ur.fk_users
        LEFT JOIN replacement_plan sp ON sp.id = ur.fk_replacement_plan
        LEFT JOIN rc_details rin      ON rin.id = ur.fk_rc_details_replacing
        LEFT JOIN rc_details red      ON red.id = ur.fk_rc_details_replaced
    ) AS user_replaced`,
    writable: [
      "fk_users",
      "fk_user_subscribed",
      "fk_rc_details_replacing",
      "fk_rc_details_replaced",
      "fk_replacement_plan",
      "payment_id",
      "is_active",
    ],
    search: ["user_name", "mobile_number", "replacing_vehicle", "replaced_vehicle"],
    order: "created_at DESC",
    references: {
      fk_users: { resource: "users", labelField: "user_name" },
      fk_replacement_plan: {
        resource: "replacement-plans",
        labelField: "plan_name",
      },
      fk_rc_details_replacing: { resource: "rc-details", labelField: "reg_no" },
      fk_rc_details_replaced: { resource: "rc-details", labelField: "reg_no" },
    },
    display: [
      c("id", "ID"),
      c("user_name", "User"),
      c("mobile_number", "Mobile"),
      c("plan_name", "Replacement Plan"),
      c("replacing_vehicle", "New Vehicle"),
      c("replaced_vehicle", "Old Vehicle"),
      c("is_active", "Active"),
    ],
  },
  invoices: {
    group: "Billing",
    label: "Invoices",
    table: "invoices",
    source: `(
      SELECT i.*,
             u.user_name,
             u.mobile_number,
             su.state_union_name AS user_state,
             p.payment_id        AS razorpay_payment_id,
             p.amount            AS payment_amount_paise,
             p.status            AS payment_status,
             p.method            AS payment_method,
             sp.plan_name,
             sp.plan_code,
             us.active_on,
             us.expires_on
        FROM invoices i
        LEFT JOIN users u            ON u.id  = i.fk_users
        LEFT JOIN states_unions su   ON su.id = u.fk_states_unions
        LEFT JOIN payments p         ON p.id  = i.payment_id
        LEFT JOIN user_subscribed us ON us.id = i.fk_user_subscribed
        LEFT JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
    ) AS invoices`,
    writable: [
      "fk_users",
      "fk_user_subscribed",
      "payment_id",
      "invoice_id",
      "invoice_path",
      "replacement_flag",
      "fk_replacement_plan",
      "is_active",
    ],
    search: ["invoice_id", "user_name", "mobile_number", "plan_name"],
    order: "created_at DESC",
    references: {
      fk_users: { resource: "users", labelField: "user_name" },
      fk_replacement_plan: {
        resource: "replacement-plans",
        labelField: "plan_name",
      },
    },
    display: [
      c("id", "ID"),
      c("invoice_id", "Invoice No."),
      c("user_name", "Subscriber"),
      c("mobile_number", "Mobile"),
      c("plan_name", "Plan"),
      c("payment_amount_paise", "Amount (paise)"),
      c("payment_status", "Payment"),
      c("created_at", "Created"),
      c("is_active", "Active"),
    ],
  },
  payments: {
    group: "Billing",
    label: "Payments",
    table: "payments",
    source: `(
      SELECT p.*,
             u.user_name,
             u.mobile_number,
             i.invoice_id   AS linked_invoice_id,
             i.invoice_path AS linked_invoice_path,
             sp.plan_name
        FROM payments p
        LEFT JOIN invoices i         ON i.payment_id = p.id
        LEFT JOIN users u            ON u.id  = i.fk_users
        LEFT JOIN user_subscribed us ON us.id = i.fk_user_subscribed
        LEFT JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
    ) AS payments`,
    writable: ["status", "refund_status", "amount_refunded", "is_active"],
    search: [
      "payment_id",
      "order_id",
      "invoice_id",
      "email",
      "contact",
      "user_name",
      "mobile_number",
    ],
    order: "created_at DESC",
    display: [
      c("id", "ID"),
      c("payment_id", "Payment ID"),
      c("user_name", "Subscriber"),
      c("mobile_number", "Mobile"),
      c("plan_name", "Plan"),
      c("amount", "Amount (paise)"),
      c("status", "Status"),
      c("method", "Method"),
      c("created_at", "Created"),
    ],
  },

  /* ------------------------- vehicle data -------------------------------- */
  "rc-details": {
    group: "Vehicles",
    label: "RC Details",
    table: "rc_details",
    source: `(
      SELECT r.*, u.user_name, u.mobile_number AS user_mobile
        FROM rc_details r
        LEFT JOIN users u ON u.id = r.fk_users
    ) AS rc_details`,
    writable: [
      "fk_users",
      "reg_no",
      "vehicle_class",
      "chassis",
      "engine",
      "vehicle_manufacturer_name",
      "model",
      "vehicle_colour",
      "fuel_type",
      "owner_name",
      "owner_father_name",
      "mobile_number",
      "vehicle_status",
      "reg_authority",
      "reg_date",
      "rc_expiry_date",
      "vehicle_insurance_company_name",
      "vehicle_insurance_upto",
      "vehicle_insurance_policy_number",
      "pucc_number",
      "pucc_upto",
      "rto_code",
      "financed",
      "is_active",
    ],
    search: ["reg_no", "owner_name", "mobile_number", "chassis", "engine", "user_name"],
    order: "created_at DESC",
    references: {
      fk_users: { resource: "users", labelField: "user_name" },
    },
    display: [
      c("id", "ID"),
      c("reg_no", "Vehicle No."),
      c("owner_name", "Owner"),
      c("user_name", "Account User"),
      c("mobile_number", "Mobile"),
      c("vehicle_manufacturer_name", "Maker"),
      c("model", "Model"),
      c("rc_expiry_date", "RC Expiry"),
      c("rc_expiry_remaining_datys", "RC Days Left"),
      c("vehicle_insurance_upto", "Insurance Upto"),
      c("insurance_expiry_remaining_datys", "Insurance Days Left"),
      c("pucc_upto", "PUCC Upto"),
      c("pucc_expiry_remaining_datys", "PUCC Days Left"),
      c("is_active", "Active"),
    ],
    children: [
      { resource: "challan-details", label: "Challans", fk: "fk_rc_details" },
      { resource: "fastag-details", label: "FASTags", fk: "fk_rc_details" },
    ],
  },
  "challan-details": {
    group: "Vehicles",
    label: "Challan Details",
    table: "challan_details",
    source: `(
      SELECT ch.*, r.reg_no AS vehicle_number
        FROM challan_details ch
        LEFT JOIN rc_details r ON r.id = ch.fk_rc_details
    ) AS challan_details`,
    writable: [
      "fk_rc_details",
      "challan_no",
      "challan_for",
      "accused_type",
      "violator_name",
      "violator_contact_no",
      "dl_rc_number",
      "state",
      "challan_date",
      "offence",
      "penalty",
      "challan_amount",
      "challan_status",
      "payment_source",
      "payment_date",
      "transaction_id",
      "rto_name",
      "owner_name",
      "court_status",
      "is_active",
    ],
    search: ["challan_no", "dl_rc_number", "violator_name", "owner_name", "vehicle_number"],
    order: "challan_date DESC NULLS LAST, id DESC",
    references: {
      fk_rc_details: { resource: "rc-details", labelField: "reg_no" },
    },
    display: [
      c("id", "ID"),
      c("vehicle_number", "Vehicle No."),
      c("challan_no", "Challan No."),
      c("challan_status", "Status"),
      c("challan_amount", "Amount (₹)"),
      c("challan_date", "Date"),
      c("owner_name", "Owner"),
      c("offence", "Offence"),
      c("is_active", "Active"),
    ],
    children: [
      {
        resource: "violation-details",
        label: "Violation details",
        fk: "fk_challan_details",
      },
    ],
  },
  "violation-details": {
    group: "Vehicles",
    label: "Violation Details",
    table: "violation_details",
    source: `(
      SELECT v.*, ch.challan_no, r.reg_no AS vehicle_number
        FROM violation_details v
        LEFT JOIN challan_details ch ON ch.id = v.fk_challan_details
        LEFT JOIN rc_details r       ON r.id = ch.fk_rc_details
    ) AS violation_details`,
    writable: ["fk_challan_details", "offence", "penalty", "is_active"],
    search: ["offence", "challan_no", "vehicle_number"],
    order: "id DESC",
    references: {
      fk_challan_details: { resource: "challan-details", labelField: "challan_no" },
    },
    display: [
      c("id", "ID"),
      c("challan_no", "Challan No."),
      c("vehicle_number", "Vehicle No."),
      c("offence", "Offence"),
      c("penalty", "Penalty (₹)"),
      c("is_active", "Active"),
    ],
  },
  "fastag-details": {
    group: "Vehicles",
    label: "FASTag Details",
    table: "fastag_details",
    source: `(
      SELECT f.*, r.reg_no AS vehicle_number
        FROM fastag_details f
        LEFT JOIN rc_details r ON r.id = f.fk_rc_details
    ) AS fastag_details`,
    writable: [
      "fk_rc_details",
      "fastag_id",
      "status",
      "bank_name",
      "customer_name",
      "balance",
      "issued_date",
      "is_active",
    ],
    search: ["fastag_id", "bank_name", "customer_name", "vehicle_number"],
    order: "created_at DESC",
    references: {
      fk_rc_details: { resource: "rc-details", labelField: "reg_no" },
    },
    display: [
      c("id", "ID"),
      c("vehicle_number", "Vehicle No."),
      c("fastag_id", "FASTag ID"),
      c("status", "Status"),
      c("bank_name", "Bank"),
      c("customer_name", "Customer"),
      c("balance", "Balance (₹)"),
      c("is_active", "Active"),
    ],
  },

  /* ------------------------------ system -------------------------------- */
  "message-logs": {
    group: "System",
    label: "Message Logs",
    table: "message_logs",
    source: `(
      SELECT m.*, u.user_name, r.reg_no AS vehicle_number
        FROM message_logs m
        LEFT JOIN users u      ON u.id = m.fk_users
        LEFT JOIN rc_details r ON r.id = m.fk_rc_details
    ) AS message_logs`,
    writable: [
      "fk_users",
      "fk_rc_details",
      "message_type",
      "message_content",
      "is_sent",
      "is_failed",
      "comments",
    ],
    search: ["message_type", "message_content", "comments", "user_name", "vehicle_number"],
    order: "created_at DESC",
    references: {
      fk_users: { resource: "users", labelField: "user_name" },
      fk_rc_details: { resource: "rc-details", labelField: "reg_no" },
    },
    display: [
      c("id", "ID"),
      c("user_name", "User"),
      c("vehicle_number", "Vehicle No."),
      c("message_type", "Type"),
      c("is_sent", "Sent?"),
      c("is_failed", "Failed?"),
      c("created_at", "Created"),
    ],
  },
  "api-logs": {
    group: "System",
    label: "API Logs",
    table: "api_logs",
    writable: [],
    search: ["method", "endpoint", "mobile_number", "vehicle_number"],
    order: "created_at DESC",
    readonly: true,
    display: [
      c("id", "ID"),
      c("method", "Method"),
      c("endpoint", "Endpoint"),
      c("mobile_number", "Mobile"),
      c("vehicle_number", "Vehicle"),
      c("status_code", "Status"),
      c("response_time_ms", "Time (ms)"),
      c("created_at", "Created"),
    ],
  },
  "otp-sessions": {
    group: "System",
    label: "OTP Sessions",
    table: "otp_sessions",
    writable: ["is_active"],
    search: ["mobile_number"],
    order: "created_at DESC",
    display: [
      c("id", "ID"),
      c("mobile_number", "Mobile"),
      c("otp", "OTP"),
      c("expires_at", "Expires"),
      c("is_active", "Active"),
      c("created_at", "Created"),
    ],
  },
};

module.exports = resources;
