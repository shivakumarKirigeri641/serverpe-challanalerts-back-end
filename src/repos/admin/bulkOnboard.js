const crypto = require("crypto");
const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const {
  fetchVehicleExternalDetails,
} = require("../insertions/insertNewVehicle");
const getRCInsertQuery = require("../../utils/getRCInsertQuery");
const insertOtpForSubscription = require("../insertions/insertOtpForSubscription");
const verifyOtpForLogin = require("../insertions/verifyOtpForLogin");
const checkIfVehicleExists = require("../checks/checkIfVehicleExists");
const checkIfMobileNumberAlreadySubscribed = require("../checks/checkIfMobileNumberAlreadySubscribed");
const generateInvoicePdf = require("../../temp/generateInvoicePdf");
const getNextInvoiceId = require("../../utils/getNextInvoiceId");
const { generateOTP } = require("../../utils/generateOTP");

const pool = connectDB();

/**
 * Admin BULK onboarding — create one user (OTP-verified), add multiple vehicles
 * (each does ONE billed RC API call and is persisted immediately), show a live
 * GST-broken-up bill at the per-vehicle rate of the largest plan (Joint Family =
 * price ÷ vehicle_limit), then generate a single invoice.
 */

const ok = (message, data) => ({
  statuscode: 200,
  successstatus: true,
  message,
  data,
});
const fail = (statuscode, message) => ({ statuscode, successstatus: false, message });
const normPlate = (v) => String(v || "").toUpperCase().replace(/\s+/g, "");

/** The per-vehicle bulk rate = largest active paid plan's price ÷ vehicle_limit. */
const getPerVehicleRate = async () => {
  const r = await pool.query(
    `select id, plan_name, vehicle_limit, price
       from subscription_plans
      where coalesce(is_trial, false) = false and is_active = true
      order by vehicle_limit desc limit 1`,
  );
  const plan = r.rows[0];
  if (!plan) return null;
  return {
    plan,
    per_vehicle: +(Number(plan.price) / (plan.vehicle_limit || 1)).toFixed(2),
  };
};

/** GST-inclusive bill breakup for a given count + per-vehicle rate. */
const buildBill = (count, perVehicle, gstPercent) => {
  const gross = +(perVehicle * count).toFixed(2);
  const rate = Number(gstPercent) || 0;
  const taxable = rate > 0 ? +(gross / (1 + rate / 100)).toFixed(2) : gross;
  const gst = +(gross - taxable).toFixed(2);
  return {
    count,
    per_vehicle: perVehicle,
    gst_percent: rate,
    taxable_value: taxable,
    gst_amount: gst,
    total: gross,
  };
};

const activeGstPercent = async () => {
  const r = await pool.query(
    `select gst_percent from gst_percents where is_active = true order by id limit 1`,
  );
  return Number(r.rows[0]?.gst_percent || 0);
};

/** Vehicles + live bill for a user. */
const summaryFor = async (fk_users) => {
  const vehicles = await pool.query(
    `select id as rc_id, reg_no, vehicle_manufacturer_name, model, vehicle_colour, vehicle_class
       from rc_details
      where fk_users = $1 and coalesce(is_active, true) = true
      order by created_at`,
    [fk_users],
  );
  const rate = await getPerVehicleRate();
  const gst = await activeGstPercent();
  return {
    vehicles: vehicles.rows,
    bill: buildBill(vehicles.rows.length, rate?.per_vehicle || 0, gst),
  };
};

/* 1) Send OTP to the (new) user's mobile. */
const bulkSendOtp = async (mobile_number) => {
  try {
    const dup = await checkIfMobileNumberAlreadySubscribed(mobile_number);
    if (!dup.successstatus) return dup; // already a user
    const otp = generateOTP();
    const r = await insertOtpForSubscription(mobile_number, otp);
    if (!r.successstatus) return fail(500, "Failed to send OTP");
    return ok("OTP sent to the user's mobile.");
  } catch (err) {
    return fail(500, `Failed to send OTP. Error: ${err.message}`);
  }
};

/* 2) Verify OTP + create the user. */
const bulkCreateUser = async ({ user_name, mobile_number, otp, fk_states_unions }) => {
  try {
    if (!user_name || !mobile_number || !otp)
      return fail(400, "user_name, mobile_number and otp are required");
    const v = await verifyOtpForLogin(mobile_number, otp);
    if (!v.successstatus) return v; // invalid/expired OTP
    const res = await pool.query(
      `insert into users (user_name, mobile_number, fk_states_unions)
       values ($1,$2,$3) on conflict (mobile_number) do nothing returning id, user_name, mobile_number`,
      [user_name, mobile_number, fk_states_unions || null],
    );
    if (res.rows.length === 0)
      return fail(409, "A user with this mobile number already exists");
    const summary = await summaryFor(res.rows[0].id);
    return ok("User created. Now add vehicles.", { user: res.rows[0], ...summary });
  } catch (err) {
    return fail(500, `Failed to create user. Error: ${err.message}`);
  }
};

/* 3) Add a vehicle — ONE billed RC call, persisted immediately. */
const bulkAddVehicle = async ({ fk_users, vehicle_number }) => {
  try {
    if (!fk_users || !vehicle_number)
      return fail(400, "fk_users and vehicle_number are required");
    const reg = normPlate(vehicle_number);
    const exists = await checkIfVehicleExists(reg);
    if (!exists.successstatus) return exists; // already on platform

    // ONE external RC call (billed ~₹2.9; logged in external_api_calls).
    const { rc } = await fetchVehicleExternalDetails(reg);
    const rcData = rc?.data?.data;
    if (!rcData) return fail(502, "Could not fetch RC details for this vehicle");

    const { myqueryrc, valuesrc } = getRCInsertQuery(fk_users, rcData);
    const inserted = await pool.query(myqueryrc, valuesrc);

    const summary = await summaryFor(fk_users);
    return ok("Vehicle added.", { vehicle: inserted.rows[0], ...summary });
  } catch (err) {
    return fail(500, `Failed to add vehicle. Error: ${err.message}`);
  }
};

/* 4) Remove a just-added vehicle (hard delete — not yet invoiced). */
const bulkRemoveVehicle = async ({ fk_users, rc_id }) => {
  try {
    await pool.query(`delete from rc_details where id = $1 and fk_users = $2`, [
      rc_id,
      fk_users,
    ]);
    const summary = await summaryFor(fk_users);
    return ok("Vehicle removed.", summary);
  } catch (err) {
    return fail(500, `Failed to remove vehicle. Error: ${err.message}`);
  }
};

/* 5) Live summary refresh. */
const bulkSummary = async (fk_users) => {
  try {
    if (!fk_users) return fail(400, "fk_users is required");
    return ok("Summary", await summaryFor(fk_users));
  } catch (err) {
    return fail(500, `Failed to fetch summary. Error: ${err.message}`);
  }
};

/* 6) Create a Razorpay order for the current bill (amount = per_vehicle × N). */
const bulkCreateOrder = async ({ fk_users }) => {
  try {
    if (!fk_users) return fail(400, "fk_users is required");
    const vehRes = await pool.query(
      `select reg_no from rc_details where fk_users = $1 and coalesce(is_active,true)=true order by created_at`,
      [fk_users],
    );
    const regNos = vehRes.rows.map((r) => r.reg_no);
    if (regNos.length === 0)
      return fail(400, "Add at least one vehicle before paying");

    const rate = await getPerVehicleRate();
    if (!rate) return fail(500, "No active plan to price against");
    const gstPercent = await activeGstPercent();
    const bill = buildBill(regNos.length, rate.per_vehicle, gstPercent);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(bill.total * 100), // paise, GST-inclusive
      currency: "INR",
      receipt: `blk_${Date.now()}`,
      notes: {
        type: "bulk_onboarding",
        fk_users: String(fk_users),
        count: String(regNos.length),
        vehicles: regNos.join(","),
      },
    });

    return ok("Order created", {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      bill,
      vehicles: regNos,
    });
  } catch (err) {
    return fail(
      500,
      `Failed to create order. Error: ${err?.error?.description || err.message}`,
    );
  }
};

/* 7) Verify the Razorpay payment, persist it + create subscription + invoice. */
const bulkVerifyPayment = async ({
  fk_users,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!fk_users || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return fail(400, "fk_users and razorpay order/payment/signature are required");

  // Signature check (no DB work if it fails).
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature)
    return fail(400, "Payment signature verification failed");

  let client;
  try {
    const razorpay = getRazorpay();
    const pay = await razorpay.payments.fetch(razorpay_payment_id);

    const userRes = await pool.query(
      `select u.id, u.user_name, u.mobile_number, su.state_union_name
         from users u left join states_unions su on su.id = u.fk_states_unions
        where u.id = $1`,
      [fk_users],
    );
    const user = userRes.rows[0];
    if (!user) return fail(404, "User not found");

    const vehRes = await pool.query(
      `select reg_no from rc_details where fk_users = $1 and coalesce(is_active,true)=true order by created_at`,
      [fk_users],
    );
    const regNos = vehRes.rows.map((r) => r.reg_no);
    if (regNos.length === 0) return fail(400, "No vehicles to invoice");

    const rate = await getPerVehicleRate();
    const gstPercent = await activeGstPercent();
    const bill = buildBill(regNos.length, rate.per_vehicle, gstPercent);

    const gdRes = await pool.query(
      `select gd.*, su.state_union_name as gst_state_name
         from gst_details gd left join states_unions su on su.id = gd.state_union_id
        where coalesce(gd.is_active,true)=true order by gd.id limit 1`,
    );
    const gstDetails = gdRes.rows[0] || {};

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      user.mobile_number,
    ]);

    // Idempotency: this payment already processed?
    const already = await client.query(
      `select id from payments where payment_id = $1`,
      [pay.id],
    );
    if (already.rows.length > 0) {
      await client.query("ROLLBACK");
      return fail(409, "This payment was already processed");
    }

    // Subscription (1 year), referencing the per-vehicle-rate plan.
    await client.query(
      `update user_subscribed set is_active = false where fk_users = $1`,
      [fk_users],
    );
    const subRes = await client.query(
      `insert into user_subscribed (fk_users, fk_subscription_plans, active_on, expires_on, expiry_days)
       values ($1,$2, now(), now() + interval '1 year',
               ((now() + interval '1 year')::date - CURRENT_DATE)) returning id, expires_on`,
      [fk_users, rate.plan.id],
    );
    const subscription = subRes.rows[0];

    // Persist the Razorpay payment entity.
    const paymentInsert = await client.query(
      `insert into payments (
         payment_id, entity, amount, currency, status, order_id, international,
         method, amount_refunded, captured, description, card_id, bank, wallet,
         vpa, email, contact, notes, acquirer_data, upi, fee, tax,
         error_code, error_description, error_source, error_step, error_reason
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
       ) returning id`,
      [
        pay.id, pay.entity, pay.amount, pay.currency, pay.status, pay.order_id,
        pay.international, pay.method, pay.amount_refunded, pay.captured,
        pay.description, pay.card_id, pay.bank, pay.wallet, pay.vpa, pay.email,
        pay.contact, pay.notes ? JSON.stringify(pay.notes) : null,
        pay.acquirer_data ? JSON.stringify(pay.acquirer_data) : null,
        pay.upi ? JSON.stringify(pay.upi) : null, pay.fee || 0, pay.tax || 0,
        pay.error_code, pay.error_description, pay.error_source, pay.error_step,
        pay.error_reason,
      ],
    );
    const paymentRowId = paymentInsert.rows[0].id;

    const invoiceId = await getNextInvoiceId(client, "INVB"); // INVB = bulk
    const invoicePath = await generateInvoicePdf({
      invoice_id: invoiceId,
      payment_id: pay.id,
      order_id: razorpay_order_id,
      created_at: new Date(),
      user: {
        user_name: user.user_name,
        mobile_number: user.mobile_number,
        state_union_name: user.state_union_name,
      },
      plan: {
        plan_name: `Bulk onboarding — ${regNos.length} vehicle(s) @ ₹${rate.per_vehicle}`,
        validity_days: 365,
        vehicle_limit: regNos.length,
      },
      vehicles: regNos,
      amount_paise: pay.amount,
      gst_percent: gstPercent,
      gst_details: gstDetails,
      expires_on: subscription.expires_on,
    });
    if (!invoicePath) {
      await client.query("ROLLBACK");
      return fail(500, "Failed to generate the invoice PDF");
    }

    const invRes = await client.query(
      `insert into invoices (fk_users, fk_user_subscribed, payment_id, invoice_id, invoice_path)
       values ($1,$2,$3,$4,$5) returning invoice_id`,
      [fk_users, subscription.id, paymentRowId, invoiceId, invoicePath],
    );
    await client.query("COMMIT");

    return ok("Payment verified & invoice generated.", {
      invoice_id: invRes.rows[0].invoice_id,
      bill,
      vehicles: regNos,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
    }
    return fail(500, `Failed to verify payment. Error: ${err.message}`);
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  bulkSendOtp,
  bulkCreateUser,
  bulkAddVehicle,
  bulkRemoveVehicle,
  bulkSummary,
  bulkCreateOrder,
  bulkVerifyPayment,
};
