const { sendWhatsApp } = require("./sendWhatsApp");
const sendWelcomeSMS = require("./sendWelcomeSMS");
const getRemainingDays = require("../utils/getRemainingDays");

/**
 * Welcome message on subscription. Uses the common WhatsApp sender with the
 * approved "amv_welcome_v1" template (body params: user name, vehicle number,
 * trial expiry date). If WhatsApp fails, the common sender invokes the SMS
 * fallback passed here, so a new subscriber always gets a confirmation.
 *
 * @param {import('pg').Pool} pool
 * @param {string} user_name
 * @param {string} vehicle_number
 * @param {string} mobile_number    cleaned 10-digit
 * @param {string} expiry_date      YYYY-MM-DD
 */
const sendVDHReportToWhatsapp = async (
  pool,
  user_name,
  vehicle_number,
  rc_expiry_date,
  insurance_expiry_date,
  pucc_expiry_date,
  fastag_details,
  next_vdh_report_date,
  mobile_number,
) => {
  let rc_remaining_days = getRemainingDays(rc_expiry_date);
  let rc_exp_details =
    0 < rc_remaining_days
      ? 30 > rc_remaining_days
        ? `⚠️ ${rc_expiry_date} (${rc_remaining_days} days remaining)`
        : `${rc_expiry_date}`
      : `Expired ${rc_remaining_days * -1} days ago`;

  //ins
  let ins_remaining_days = getRemainingDays(insurance_expiry_date);
  let ins_exp_details =
    0 < ins_remaining_days
      ? 30 > ins_remaining_days
        ? `⚠️ ${insurance_expiry_date} (${ins_remaining_days} days remaining)`
        : `${insurance_expiry_date}`
      : `Expired ${ins_remaining_days * -1} days ago`;

  //puc
  let pucc_remaining_days = 0;
  let pucc_exp_details = null;
  if (pucc_expiry_date) {
    pucc_remaining_days = getRemainingDays(pucc_expiry_date);
    pucc_exp_details =
      0 < pucc_remaining_days
        ? 30 > pucc_remaining_days
          ? `⚠️ ${pucc_expiry_date} (${pucc_remaining_days} days remaining)`
          : `${pucc_expiry_date}`
        : `Expired ${pucc_remaining_days * -1} days ago`;
  }
  //fastag
  sendWhatsApp({
    mobile_number,
    template: "amv_vdh_v1",
    params: [
      user_name,
      vehicle_number,
      rc_exp_details,
      ins_exp_details,
      pucc_expiry_date ? pucc_exp_details : `PUCC not found`,
      fastag_details,
      next_vdh_report_date,
    ],
    /*onSmsFallback: () =>
      sendWelcomeSMS(pool, vehicle_number, mobile_number, expiry_date),*/
  });
};

module.exports = sendVDHReportToWhatsapp;
