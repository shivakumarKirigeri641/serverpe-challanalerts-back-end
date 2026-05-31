const crypto = require("crypto");
const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const generateInvoicePdf = require("../../temp/generateInvoicePdf");
const insertNewVehicle = require("./insertNewVehicle");
const pool = connectDB();

/**
 * Verifies a Razorpay payment for replacing a vehicle, then (in one transaction):
 *  - retires the old vehicle (rc_details.is_active=false),
 *  - ensures the new vehicle exists under the user (fetches+inserts it),
 *  - records the swap in user_replaced (who / which subscription / new / old),
 *  - persists the payment row (from the Razorpay payment entity),
 *  - generates a GST invoice PDF and inserts the invoices row.
 *
 * The user must already have an active subscription — a replacement swaps a
 * vehicle on that plan, it does not create or extend one.
 *
 * @param {object} p mobile_number, fk_replacement_plan, old_vehicle_number,
 *                    new_vehicle_number, razorpay_order_id,
 *                    razorpay_payment_id, razorpay_signature
 */
const verifyReplaceVehiclePayment = async (p) => {
  const {
    mobile_number,
    fk_replacement_plan,
    old_vehicle_number,
    new_vehicle_number,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = p;

  // 1) Signature check (no DB work if this fails).
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    return {
      statuscode: 400,
      successstatus: false,
      message: "Payment signature verification failed",
    };
  }

  try {
    // 2) Pull the captured payment entity from Razorpay (source of truth).
    const razorpay = getRazorpay();
    const pay = await razorpay.payments.fetch(razorpay_payment_id);

    await pool.query(`BEGIN`);

    // 3) User must exist (replacement happens from the dashboard, post-OTP).
    const userRes = await pool.query(
      `select u.*, su.state_union_name from users u
       left join states_unions su on su.id = u.fk_states_unions
       where u.mobile_number=$1 and u.is_active=true`,
      [mobile_number],
    );
    if (userRes.rows.length === 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 404,
        successstatus: false,
        message: "User not found",
      };
    }
    const user = userRes.rows[0];

    // 4) Replacement plan (the swap fee).
    const planRes = await pool.query(
      `select * from replacement_plan where id=$1 and is_active=true and price>0`,
      [fk_replacement_plan],
    );
    if (planRes.rows.length === 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 404,
        successstatus: false,
        message: "Replacement plan not found",
      };
    }
    const plan = planRes.rows[0];

    // 5) The user must have an active subscription to swap a vehicle on.
    const subRes = await pool.query(
      `select * from user_subscribed where fk_users=$1 and is_active=true
       order by id desc limit 1`,
      [user.id],
    );
    if (subRes.rows.length === 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 400,
        successstatus: false,
        message: "No active subscription to replace a vehicle on",
      };
    }
    const subscription = subRes.rows[0];

    // 6) The old vehicle must be an active vehicle owned by this user.
    const oldRes = await pool.query(
      `select * from rc_details where reg_no=$1 and fk_users=$2 and is_active=true`,
      [old_vehicle_number, user.id],
    );
    if (oldRes.rows.length === 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 404,
        successstatus: false,
        message: "The vehicle to replace was not found on your account",
      };
    }
    const oldVehicle = oldRes.rows[0];

    // 7) The new vehicle must not already exist on the platform.
    const newExisting = await pool.query(
      `select id from rc_details where reg_no=$1`,
      [new_vehicle_number],
    );
    if (newExisting.rows.length > 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 400,
        successstatus: false,
        message: "The new vehicle is already present on the platform",
      };
    }
    const newVehicle = await insertNewVehicle(user.id, new_vehicle_number);

    // 8) Retire the old vehicle (kept for the audit trail / FK below).
    await pool.query(`update rc_details set is_active=false where id=$1`, [
      oldVehicle.id,
    ]);

    // 9) Persist the payment (mirror of Razorpay payment entity).
    const paymentInsert = await pool.query(
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
    const paymentRowId = paymentInsert.rows[0].id;

    // 10) Record the swap.
    const replacedRes = await pool.query(
      `insert into user_replaced (
         fk_users, fk_user_subscribed, fk_rc_details_replacing,
         fk_rc_details_replaced, fk_replacement_plan, payment_id
       ) values ($1,$2,$3,$4,$5,$6) returning *`,
      [
        user.id,
        subscription.id,
        newVehicle.id,
        oldVehicle.id,
        plan.id,
        paymentRowId,
      ],
    );

    // 11) GST breakup (fee is GST-inclusive) → invoice PDF + invoices row.
    const gstRes = await pool.query(
      `select gst_percent from gst_percents where is_active=true limit 1`,
    );
    const gstPercent = gstRes.rows[0]?.gst_percent ?? 0;

    // Seller / GST registration details for the "Sold by" block.
    const gstDetailsRes = await pool.query(
      `select gd.*, su.state_union_name as gst_state_name
         from gst_details gd
         left join states_unions su on su.id = gd.state_union_id
         order by gd.id limit 1`,
    );
    const gstDetails = gstDetailsRes.rows[0] || {};

    // Invoice no: INV-YYYYMMDD-<n> where n = today's invoice count + 1.
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const todayCountRes = await pool.query(
      `select count(*)::int as c from invoices where created_at::date = current_date`,
    );
    const seq = (todayCountRes.rows[0]?.c ?? 0) + 1;
    // Replacement invoices are prefixed INVR (subscription ones use INV).
    const invoiceId = `INVR-${yyyymmdd}-${seq}`;

    const invoicePath = await generateInvoicePdf({
      invoice_id: invoiceId,
      payment_id: pay.id,
      order_id: pay.order_id,
      created_at: now,
      user: {
        user_name: user.user_name,
        mobile_number: user.mobile_number,
        state_union_name: user.state_union_name,
      },
      // The replacement offer billed as the line item; the swap doesn't change
      // the subscription's existing validity, so "Valid until" mirrors it.
      plan: {
        plan_name: `${plan.plan_name} (${oldVehicle.reg_no} → ${newVehicle.reg_no})`,
        validity_days: "",
      },
      vehicles: [newVehicle.reg_no],
      amount_paise: pay.amount,
      gst_percent: gstPercent,
      gst_details: gstDetails,
      expires_on: subscription.expires_on,
    });

    if (!invoicePath) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 500,
        successstatus: false,
        message: "Failed to generate the invoice",
      };
    }

    const invoiceRes = await pool.query(
      `insert into invoices (fk_users, fk_user_subscribed, payment_id, invoice_id, invoice_path, replacement_flag, fk_replacement_plan)
       values ($1,$2,$3,$4,$5,true,$6) returning *`,
      [user.id, subscription.id, paymentRowId, invoiceId, invoicePath, plan.id],
    );

    await pool.query(`COMMIT`);

    return {
      statuscode: 200,
      successstatus: true,
      message: "Payment verified and vehicle replaced",
      data: {
        user_details: {
          user_name: user.user_name,
          mobile_number: user.mobile_number,
          state_union_name: user.state_union_name,
        },
        plan,
        replaced_vehicle: {
          reg_no: oldVehicle.reg_no,
          vehicle_manufacturer_name: oldVehicle.vehicle_manufacturer_name,
          model: oldVehicle.model,
        },
        new_vehicle: {
          reg_no: newVehicle.reg_no,
          vehicle_manufacturer_name: newVehicle.vehicle_manufacturer_name,
          model: newVehicle.model,
        },
        subscription,
        replacement: replacedRes.rows[0],
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
    await pool.query(`ROLLBACK`);
    return {
      statuscode: 500,
      successstatus: false,
      message: `Failed to verify payment. Error: ${err?.error?.description || err.message}`,
    };
  }
};

module.exports = verifyReplaceVehiclePayment;
