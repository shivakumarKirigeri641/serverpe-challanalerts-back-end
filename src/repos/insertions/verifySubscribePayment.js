const crypto = require("crypto");
const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const generateInvoicePdf = require("../../temp/generateInvoicePdf");
const insertNewVehicle = require("./insertNewVehicle");
const { fetchVehicleExternalDetails } = require("./insertNewVehicle");
const getNextInvoiceId = require("../../utils/getNextInvoiceId");
const sendWelcomeWhatsApp = require("../../comms/sendWelcomeWhatsApp");
const sendRCStatusSMS = require("../../comms/sendRCStatusSMS");
const pool = connectDB();

/**
 * Verifies a Razorpay payment for a NEW subscription (the paid trial), then in
 * one transaction creates the user, fetches+stores their vehicle (RC + challans
 * + violations + fastag = challan check #1), activates the trial for the plan's
 * validity_days, persists the payment, and generates the GST invoice.
 *
 * The trial plan is resolved server-side (the active plan flagged is_trial),
 * mirroring createSubscribeOrder. Network I/O (external RC/challan/fastag) BEFORE
 * the transaction so it never holds a pooled connection (+ advisory lock) open.
 *
 * @param {object} p user_name, mobile_number, vehicle_number, fk_states_unions,
 *                    razorpay_order_id, razorpay_payment_id, razorpay_signature
 */
const verifySubscribePayment = async (p) => {
  const {
    user_name,
    mobile_number,
    vehicle_number,
    fk_states_unions,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = p;

  // 1) Signature check (no DB / network work if this fails).
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    return {
      statuscode: 400,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: "Payment signature verification failed",
    };
  }

  let client;
  try {
    // 2) Captured payment entity from Razorpay (source of truth).
    const razorpay = getRazorpay();
    const pay = await razorpay.payments.fetch(razorpay_payment_id);

    // 2a) Prefetch external RC/challan/fastag BEFORE opening the transaction so
    //     the slow HTTP calls don't hold a pooled connection (+ lock) open.
    const prefetched = await fetchVehicleExternalDetails(vehicle_number);

    // 2b) One dedicated connection for the whole transaction.
    client = await pool.connect();
    await client.query(`BEGIN`);

    // 2c) Serialize this mobile's money-mutating ops (double-tap "Pay", webhook
    //     racing the client callback, etc.). Per-key lock — other users run in
    //     parallel — auto-released on COMMIT/ROLLBACK.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      mobile_number,
    ]);

    // 2d) Idempotency: if this Razorpay payment was already recorded, this
    //     subscription already happened — don't create a second one.
    const already = await client.query(
      `select id from payments where payment_id=$1`,
      [pay.id],
    );
    if (already.rows.length > 0) {
      await client.query(`ROLLBACK`);
      return {
        statuscode: 409,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: "This payment has already been processed",
      };
    }

    // 3) Create the user. Unique constraint + ON CONFLICT makes a duplicate
    //    subscribe a no-op rather than a second account.
    const result = await client.query(
      `insert into users(user_name, mobile_number, fk_states_unions) values ($1,$2,$3)
       on conflict (mobile_number) do nothing returning *;`,
      [user_name, mobile_number, fk_states_unions],
    );
    if (0 === result.rows.length) {
      await client.query(`ROLLBACK`);
      return {
        statuscode: 409,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: `User already subscribed in platform!`,
      };
    }
    const user = result.rows[0];

    // Friendly state name for the invoice "Bill to" block.
    const stateRes = await client.query(
      `select state_union_name from states_unions where id=$1`,
      [user.fk_states_unions],
    );
    const stateUnionName = stateRes.rows[0]?.state_union_name || null;

    // 4) Insert the vehicle (RC + challans + violations + fastag). The challan
    //    pull here is challan check #1 of the trial.
    const rcRow = await insertNewVehicle(
      client,
      user.id,
      vehicle_number,
      prefetched,
    );

    // 5) Trial plan (is_trial=true); activate for its validity_days.
    const planRes = await client.query(
      `select * from subscription_plans where is_active=true and is_trial=true order by price asc limit 1`,
    );
    if (planRes.rows.length === 0) {
      await client.query(`ROLLBACK`);
      return {
        statuscode: 404,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: "No active trial plan is configured",
      };
    }
    const plan = planRes.rows[0];

    const subRes = await client.query(
      `insert into user_subscribed (fk_users, fk_subscription_plans, active_on, expires_on, expiry_days)
       values ($1,$2, now(), now() + ($3 || ' days')::interval,
               ((now() + ($3 || ' days')::interval)::date - CURRENT_DATE)) returning *`,
      [user.id, plan.id, String(plan.validity_days)],
    );
    const subscription = subRes.rows[0];

    // 6) Persist the payment (mirror of the Razorpay payment entity).
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
        pay.id,
        pay.entity,
        pay.amount,
        pay.currency,
        pay.status,
        pay.order_id,
        pay.international,
        pay.method,
        pay.amount_refunded,
        pay.captured,
        pay.description,
        pay.card_id,
        pay.bank,
        pay.wallet,
        pay.vpa,
        pay.email,
        pay.contact,
        pay.notes ? JSON.stringify(pay.notes) : null,
        pay.acquirer_data ? JSON.stringify(pay.acquirer_data) : null,
        pay.upi ? JSON.stringify(pay.upi) : null,
        pay.fee || 0,
        pay.tax || 0,
        pay.error_code,
        pay.error_description,
        pay.error_source,
        pay.error_step,
        pay.error_reason,
      ],
    );

    // 7) GST breakup (price is GST-inclusive) → invoice PDF + invoices row.
    const gstRes = await client.query(
      `select gst_percent from gst_percents where is_active=true limit 1`,
    );
    const gstPercent = gstRes.rows[0]?.gst_percent ?? 0;

    const gstDetailsRes = await client.query(
      `select gd.*, su.state_union_name as gst_state_name
         from gst_details gd
         left join states_unions su on su.id = gd.state_union_id
         order by gd.id limit 1`,
    );
    const gstDetails = gstDetailsRes.rows[0] || {};

    const now = new Date();
    const invoiceId = await getNextInvoiceId(client, "INV");

    const invoicePath = await generateInvoicePdf({
      invoice_id: invoiceId,
      payment_id: pay.id,
      order_id: pay.order_id,
      created_at: now,
      user: {
        user_name: user.user_name,
        mobile_number: user.mobile_number,
        state_union_name: stateUnionName,
      },
      plan,
      vehicles: [rcRow.reg_no],
      amount_paise: pay.amount,
      gst_percent: gstPercent,
      gst_details: gstDetails,
      expires_on: subscription.expires_on,
    });

    if (!invoicePath) {
      await client.query(`ROLLBACK`);
      return {
        statuscode: 500,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: "Failed to generate the invoice",
      };
    }

    const paymentRowId = paymentInsert.rows[0].id;
    const invoiceRes = await client.query(
      `insert into invoices (fk_users, fk_user_subscribed, payment_id, invoice_id, invoice_path)
       values ($1,$2,$3,$4,$5) returning *`,
      [user.id, subscription.id, paymentRowId, invoiceId, invoicePath],
    );
    await client.query(`COMMIT`);

    // 8) Welcome (WhatsApp, SMS fallback) + RC status alerts.
    const subscriptionExpiryDate = subscription.expires_on
      .toISOString()
      .split("T")[0];
    await sendWelcomeWhatsApp(
      pool,
      user.user_name,
      vehicle_number,
      mobile_number,
      subscriptionExpiryDate,
    );
    await sendRCStatusSMS(
      pool,
      mobile_number,
      vehicle_number,
      rcRow.rc_expiry_date,
    );

    // 9) Read back the challans (+ violations) and fastag just inserted so the
    //    front-end handoff to /dashboard renders them immediately. The dashboard
    //    normalizer (normalizeDashboardData) folds `challan_details` /
    //    `fastag_details` into a single vehicle entry; each challan row carrying
    //    a `violation_details` array is enough for it.
    const challanRows = await pool.query(
      `select * from challan_details where fk_rc_details=$1 and coalesce(is_active,true)=true order by created_at`,
      [rcRow.id],
    );
    const challan_details = [];
    for (const ch of challanRows.rows) {
      const vio = await pool.query(
        `select * from violation_details where fk_challan_details=$1 order by created_at`,
        [ch.id],
      );
      challan_details.push({ ...ch, violation_details: vio.rows });
    }
    const fastagRows = await pool.query(
      `select * from fastag_details where fk_rc_details=$1 order by created_at limit 1`,
      [rcRow.id],
    );

    return {
      statuscode: 200,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: "Payment verified and subscription activated",
      data: {
        user_details: user,
        rc_details: rcRow,
        challan_details,
        fastag_details: fastagRows.rows[0] || null,
        // Same shape as getUserMasterDetails' subscription_list: plan fields
        // merged with this subscription's active_on / expires_on / is_active.
        subscription_plan: plan,
        subscription_list: [
          {
            ...plan,
            active_on: subscription.active_on,
            expires_on: subscription.expires_on,
            is_active: subscription.is_active,
            is_trial: true, // this flow always activates the trial plan
          },
        ],
        payment: {
          payment_id: pay.id,
          order_id: pay.order_id,
          amount: pay.amount,
          currency: pay.currency,
          method: pay.method,
          status: pay.status,
        },
        invoice: invoiceRes.rows[0],
      },
    };
  } catch (err) {
    if (client) {
      try {
        await client.query(`ROLLBACK`);
      } catch (_) {
        /* connection may be broken; release() below discards it */
      }
    }
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed to verify payment. Error: ${err?.error?.description || err.message}`,
    };
  } finally {
    if (client) client.release();
  }
};

module.exports = verifySubscribePayment;
