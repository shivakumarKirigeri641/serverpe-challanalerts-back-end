const path = require("path");
const {
  sendWhatsAppDocumentTemplate,
} = require("../../comms/sendWhatsApp");
const generateVdhPdf = require("../../utils/generateVdhPdf");
const { costFor } = require("../../utils/messageCost");

/**
 * Vehicle Documents Health (VDH) report — generated + WhatsApp'd every 30 days.
 *
 * WHAT  : For each due vehicle of a within-subscription user, builds a VDH PDF
 *         (user + platform + vehicle + document-health table + upcoming alerts)
 *         and sends the template "amv_vdh_with_feedaackrequest_v1" (params:
 *         user_name, vehicle_number) WITH the PDF attached as the document header.
 *         The template's "Share feedback" button → alertmyvahan.in/feedback.
 * WHY   : A periodic, shareable health snapshot + a feedback ask.
 * WHERE : Daily scheduler. Cadence is driven by rc_details.next_vdh_report_on:
 *         a vehicle is "due" when that date is <= today (NULL = due now). After a
 *         successful send it's pushed to today + 30 → so it fires once per 30 days
 *         and is idempotent across restarts / multiple runs the same day.
 * HOW   : Fire-and-forget — generation/send failures are logged, never thrown, so
 *         a problem here can't break sibling cron jobs. PDF is uploaded to WhatsApp
 *         Media (no public hosting needed). The PDF document templates fetch RC only.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{sent:number, ok:boolean}>}
 */

const VDH_TEMPLATE = "amv_vdh_with_feedaackrequest_v1";
const UPCOMING_WINDOW = 45; // list documents expiring within N days

const DOCS = [
  { label: "RC", dateField: "rc_expiry_date", remField: "rc_expiry_remaining_datys" },
  { label: "Emission test (PUCC)", dateField: "pucc_upto", remField: "pucc_expiry_remaining_datys" },
  { label: "Insurance", dateField: "vehicle_insurance_upto", remField: "insurance_expiry_remaining_datys" },
  { label: "State permit", dateField: "permit_valid_upto", remField: "state_permit_remaining_datys" },
  { label: "National permit", dateField: "national_permit_upto", remField: "permit_days" },
];

const toDateStr = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
};

/** Human-readable remaining time. Beyond a year → "X years Y months", else the
 *  day count (negative = days past expiry). */
const formatRemaining = (rem) => {
  if (rem == null) return "N/A";
  if (rem <= 365) return `${rem} day${Math.abs(rem) === 1 ? "" : "s"}`;
  const years = Math.floor(rem / 365);
  const months = Math.floor((rem % 365) / 30);
  const yPart = `${years} year${years === 1 ? "" : "s"}`;
  const mPart = months > 0 ? ` ${months} month${months === 1 ? "" : "s"}` : "";
  return `${yPart}${mPart}`;
};

/** Document status from its remaining-days (null date = Not applicable). */
const statusOf = (remaining, hasDate) => {
  if (!hasDate || remaining == null) return "Not applicable";
  if (remaining < 0) return "Expired";
  if (remaining <= 30) return "Due soon";
  return "Valid";
};

/** Mask an owner name: "RAMESH KUMAR" → "R***** K****". */
const maskOwner = (name) => {
  if (!name) return "N/A";
  return String(name)
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 1 ? w : w[0] + "*".repeat(Math.min(w.length - 1, 6))))
    .join(" ");
};

const handleVdhReport = async (pool) => {
  let sent = 0;
  try {
    // Platform ("prepared by") details — one active gst_details row.
    const gdRes = await pool.query(
      `select gd.*, su.state_union_name as gst_state_name
         from gst_details gd
         left join states_unions su on su.id = gd.state_union_id
        where coalesce(gd.is_active, true) = true
        order by gd.id limit 1`,
    );
    const platform = gdRes.rows[0] || {};

    // Due vehicles: within-subscription + VDH cadence reached.
    const vehicles = await pool.query(
      `select rc.id as rc_id, rc.fk_users as user_id, rc.reg_no,
              rc.vehicle_manufacturer_name, rc.model, rc.vehicle_class,
              rc.vehicle_colour, rc.owner_name, rc.blacklist_status,
              rc.rc_expiry_date, rc.rc_expiry_remaining_datys,
              rc.pucc_upto, rc.pucc_expiry_remaining_datys,
              rc.vehicle_insurance_upto, rc.insurance_expiry_remaining_datys,
              rc.permit_valid_upto, rc.state_permit_remaining_datys,
              rc.national_permit_upto, rc.permit_days,
              u.user_name, u.mobile_number, su.state_union_name
         from rc_details rc
         join users u on u.id = rc.fk_users
         left join states_unions su on su.id = u.fk_states_unions
        where coalesce(rc.is_active, true) = true
          and coalesce(u.is_active, true) = true
          and coalesce(rc.next_vdh_report_on, DATE '2000-01-01') <= CURRENT_DATE
          and exists (
            select 1 from user_subscribed us
             where us.fk_users = u.id
               and coalesce(us.is_active, true) = true
               and us.expiry_days >= 0
          )`,
    );

    const today = toDateStr(new Date());
    const next = new Date();
    next.setDate(next.getDate() + 30);
    const nextStr = toDateStr(next);

    for (const v of vehicles.rows) {
      try {
        // Build the document-health rows + the upcoming-alerts list.
        const health = [];
        const upcoming = [];
        for (const d of DOCS) {
          const date = v[d.dateField];
          const rem = v[d.remField];
          const hasDate = date != null;
          health.push({
            label: d.label,
            expiry_date: hasDate ? toDateStr(date) : "N/A",
            remaining_days: hasDate && rem != null ? formatRemaining(rem) : "N/A",
            status: statusOf(rem, hasDate),
          });
          if (hasDate && rem != null && rem >= 0 && rem <= UPCOMING_WINDOW) {
            upcoming.push({
              label: d.label,
              expiry_date: toDateStr(date),
              remaining_days: rem,
            });
          }
        }

        // Generate the PDF (returns a path relative to src/).
        const relPath = generateVdhPdf({
          report_date: today,
          next_report_date: nextStr,
          user: {
            user_name: v.user_name,
            mobile_number: v.mobile_number,
            state_union_name: v.state_union_name,
          },
          platform,
          vehicle: {
            reg_no: v.reg_no,
            manufacturer: v.vehicle_manufacturer_name,
            model: v.model,
            variant: v.vehicle_class,
            colour: v.vehicle_colour,
            owner_masked: maskOwner(v.owner_name),
          },
          health,
          blacklist_status: v.blacklist_status || "N/A",
          upcoming,
        });

        if (!relPath) {
          console.error(`[vdh] PDF generation failed for ${v.reg_no}; will retry next run`);
          continue; // don't advance cadence → retry next run
        }

        // src/ + relPath → absolute path for the media upload.
        const absPath = path.join(__dirname, "..", "..", relPath);

        const res = await sendWhatsAppDocumentTemplate({
          mobile_number: v.mobile_number,
          template: VDH_TEMPLATE,
          params: [v.user_name, v.reg_no],
          documentPath: absPath,
          documentFilename: `VDH_${v.reg_no}.pdf`,
        });

        // Advance the 30-day cadence (only after we attempted the send).
        await pool.query(
          `update rc_details set next_vdh_report_on = CURRENT_DATE + 30 where id = $1`,
          [v.rc_id],
        );

        // Log (channel WHATSAPP; semantic key in comments) + cost.
        await pool.query(
          `insert into message_logs
             (fk_users, fk_rc_details, message_type, message_content, is_sent, is_failed, comments, cost)
           values ($1,$2,'WHATSAPP',$3,$4,$5,'VDH_REPORT',$6)`,
          [
            v.user_id,
            v.rc_id,
            JSON.stringify({ template: VDH_TEMPLATE, pdf: relPath }),
            !!res.ok,
            !res.ok,
            costFor("WHATSAPP", !!res.ok),
          ],
        );

        sent += 1;
        console.log(`[vdh] report sent → ${v.mobile_number} ${v.reg_no} (next ${nextStr})`);
      } catch (err) {
        console.error(`[vdh] failed for ${v.reg_no}:`, err.message);
      }
    }

    console.log(`[vdh] done: ${sent} report(s) of ${vehicles.rows.length} due`);
    return { sent, ok: true };
  } catch (err) {
    console.error("handleVdhReport failed:", err.message);
    return { sent, ok: false };
  }
};

module.exports = handleVdhReport;
