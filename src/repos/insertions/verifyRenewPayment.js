const crypto = require("crypto");
const { connectDB } = require("../../database/connectDB");
const { getRazorpay } = require("../../utils/razorpayClient");
const generateInvoicePdf = require("../../temp/generateInvoicePdf");
const insertNewVehicle = require("./insertNewVehicle");
const pool = connectDB();

/**
 * Verifies a Razorpay payment for a renewal, then (in one transaction):
 *  - ensures each vehicle exists under the user (fetches+inserts new ones),
 *  - inserts ONE user_subscribed row for the chosen plan,
 *  - persists the payment row (from Razorpay payment entity),
 *  - generates a GST invoice PDF and inserts the invoices row.
 *
 * @param {object} p mobile_number, fk_subscription_plans, vehicle_numbers[],
 *                    razorpay_order_id, razorpay_payment_id, razorpay_signature
 */
const verifyRenewPayment = async (p) => {
  const {
    mobile_number,
    fk_subscription_plans,
    vehicle_numbers,
    remove_vehicle_numbers = [],
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

    // 3) User must exist (renewal happens from the dashboard, post-OTP).
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

    // 4) Plan.
    const planRes = await pool.query(
      `select * from subscription_plans where id=$1 and is_active=true and price>0`,
      [fk_subscription_plans],
    );
    if (planRes.rows.length === 0) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 404,
        successstatus: false,
        message: "Plan not found",
      };
    }
    const plan = planRes.rows[0];

    if (vehicle_numbers.length > plan.vehicle_limit) {
      await pool.query(`ROLLBACK`);
      return {
        statuscode: 400,
        successstatus: false,
        message: `This plan covers up to ${plan.vehicle_limit} vehicle(s)`,
      };
    }

    // 5) Ensure each vehicle exists under this user.
    const vehicleRows = [];
    for (const vno of vehicle_numbers) {
      const existing = await pool.query(
        `select * from rc_details where reg_no=$1`,
        [vno],
      );
      if (existing.rows.length > 0) {
        vehicleRows.push(existing.rows[0]);
      } else {
        vehicleRows.push(await insertNewVehicle(user.id, vno));
      }
    }

    // 5a) Make sure every covered vehicle is active (a covered plate could have
    //     been disabled by an earlier downgrade/replacement).
    if (vehicle_numbers.length) {
      await pool.query(
        `update rc_details set is_active=true where fk_users=$1 and reg_no = any($2::text[])`,
        [user.id, vehicle_numbers],
      );
    }

    // 5b) Downgrade: disable the vehicles the user chose to drop (kept for
    //     history; just hidden from the dashboard via is_active=false).
    if (Array.isArray(remove_vehicle_numbers) && remove_vehicle_numbers.length) {
      const toRemove = remove_vehicle_numbers.filter(
        (v) => !vehicle_numbers.includes(v),
      );
      if (toRemove.length) {
        await pool.query(
          `update rc_details set is_active=false where fk_users=$1 and reg_no = any($2::text[])`,
          [user.id, toRemove],
        );
      }
    }

    // 6) ONE subscription row for this renewal.
    //first make all is_active=false;
    await pool.query(
      `update user_subscribed set is_active=false where fk_users=$1`,
      [user.id],
    );
    const subRes = await pool.query(
      `insert into user_subscribed (fk_users, fk_subscription_plans, active_on, expires_on)
       values ($1,$2, now(), now() + ($3 || ' days')::interval) returning *`,
      [user.id, plan.id, String(plan.validity_days)],
    );
    const subscription = subRes.rows[0];

    // 7) Persist the payment (mirror of Razorpay payment entity).
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

    // 8) GST breakup (price is GST-inclusive) → invoice PDF + invoices row.
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
    const invoiceId = `INV-${yyyymmdd}-${seq}`;

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
      plan,
      vehicles: vehicleRows.map((r) => r.reg_no),
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

    // invoices.payment_id is the bigint FK to payments.id (not the Razorpay
    // payment string), so use the row id we just inserted.
    const paymentRowId = paymentInsert.rows[0].id;
    const invoiceRes = await pool.query(
      `insert into invoices (fk_users, fk_user_subscribed, payment_id, invoice_id, invoice_path)
       values ($1,$2,$3,$4,$5) returning *`,
      [user.id, subscription.id, paymentRowId, invoiceId, invoicePath],
    );

    await pool.query(`COMMIT`);

    return {
      statuscode: 200,
      successstatus: true,
      message: "Payment verified and subscription activated",
      data: {
        user_details: {
          user_name: user.user_name,
          mobile_number: user.mobile_number,
          state_union_name: user.state_union_name,
        },
        plan,
        vehicles: vehicleRows.map((r) => ({
          reg_no: r.reg_no,
          vehicle_manufacturer_name: r.vehicle_manufacturer_name,
          model: r.model,
        })),
        subscription,
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

module.exports = verifyRenewPayment;
