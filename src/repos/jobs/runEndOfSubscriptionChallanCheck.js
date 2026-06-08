const { connectDB } = require("../../database/connectDB");
const {
  fetchVehicleExternalDetails,
} = require("../insertions/insertNewVehicle");
const getChallanInsertQuery = require("../../utils/getChallanInsertQuery");
const pool = connectDB();

/**
 * Challan check #2 of the paid trial: the "end of subscription" challan pull.
 *
 * The trial includes two challan checks — one at subscribe time (done inside
 * verifySubscribePayment) and one when the subscription is about to lapse. This
 * job runs daily and, for every active subscription expiring TODAY, re-fetches
 * the vehicle's challans and stores any new ones.
 *
 * Idempotency without a schema change: a `message_logs` row of
 * message_type='END_TRIAL_CHALLAN' is written per (user, vehicle) once the check
 * runs. The selection query excludes anyone who already has that row, so a
 * restart / second run the same day is a no-op.
 *
 * Fire-and-forget; the caller swallows errors.
 */
const END_TRIAL_CHALLAN = "END_TRIAL_CHALLAN";

const runEndOfSubscriptionChallanCheck = async () => {
  try {
    // Subscriptions expiring today + their active vehicles, skipping any
    // (user, vehicle) already checked.
    const due = await pool.query(
      `select us.id as sub_id, u.id as user_id, u.mobile_number,
              r.id as rc_id, r.reg_no
         from user_subscribed us
         join users u       on u.id = us.fk_users and coalesce(u.is_active,true)=true
         join rc_details r  on r.fk_users = u.id and coalesce(r.is_active,true)=true
        where us.is_active = true
          and us.expires_on::date = CURRENT_DATE
          and not exists (
            select 1 from message_logs ml
             where ml.fk_users = u.id
               and ml.fk_rc_details = r.id
               and ml.message_type = $1
          )`,
      [END_TRIAL_CHALLAN],
    );

    let processed = 0;
    let newChallans = 0;

    for (const row of due.rows) {
      try {
        // Network fetch OUTSIDE the transaction (slow external HTTP must not
        // hold a pooled connection open).
        const { challan } = await fetchVehicleExternalDetails(row.reg_no);
        const items = challan?.data?.data?.data || [];
        const count = challan?.data?.data?.echallan_count || 0;

        const client = await pool.connect();
        try {
          await client.query(`BEGIN`);
          let inserted = 0;
          for (let i = 0; i < count; i++) {
            const item = items[i];
            const { myquerych, valuesch } = getChallanInsertQuery(
              row.rc_id,
              item,
            );
            // challan_no is globally unique — skip ones already stored.
            const query = myquerych.replace(
              /\s*returning/i,
              " ON CONFLICT (challan_no) DO NOTHING returning",
            );
            const ins = await client.query(query, valuesch);
            if (ins.rows.length === 0) continue; // duplicate — skipped
            inserted++;
            for (let j = 0; j < (item.violation_details?.length || 0); j++) {
              await client.query(
                `insert into violation_details (fk_challan_details, offence, penalty) values ($1,$2,$3)`,
                [
                  ins.rows[0].id,
                  item.violation_details[j].offence,
                  item.violation_details[j].penalty,
                ],
              );
            }
          }

          // Dedupe marker (also the audit record of the end-of-trial check).
          await client.query(
            `insert into message_logs (fk_users, fk_rc_details, message_type, message_content, is_sent, is_failed)
             values ($1,$2,$3,$4,false,false)`,
            [
              row.user_id,
              row.rc_id,
              END_TRIAL_CHALLAN,
              `End-of-trial challan check for ${row.reg_no}: ${inserted} new challan(s)`,
            ],
          );
          await client.query(`COMMIT`);
          processed++;
          newChallans += inserted;
        } catch (txErr) {
          try {
            await client.query(`ROLLBACK`);
          } catch (_) {
            /* connection may be broken; release() discards it */
          }
          console.error(
            `End-of-trial challan check failed for ${row.reg_no}:`,
            txErr.message,
          );
        } finally {
          client.release();
        }
      } catch (fetchErr) {
        console.error(
          `End-of-trial challan fetch failed for ${row.reg_no}:`,
          fetchErr.message,
        );
      }
    }

    console.log(
      `End-of-trial challan check: ${processed} vehicle(s) processed, ${newChallans} new challan(s)`,
    );
    return { processed, newChallans };
  } catch (err) {
    console.error("runEndOfSubscriptionChallanCheck failed:", err.message);
    throw err;
  }
};

module.exports = runEndOfSubscriptionChallanCheck;
