const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Fetch the currently active GST rate.
 *
 * WHAT  : Returns the active `gst_percents` row(s) — gst_percent + description.
 * WHY   : Prices are GST-INCLUSIVE, so the front-end needs the rate to back-calculate
 *         the tax slice for display (base = total / (1 + rate); gst = total − base).
 *         Keeping the rate in the DB means a rate change (or 0% period) is a data
 *         edit, not a deploy, and the invoice + UI stay in sync.
 * WHERE : publicRouter "GET /gst-value" (dashboard checkout breakdown). The invoice
 *         generator reads the same table directly (verifyRenewPayment → generateInvoicePdf).
 * HOW   : Read-only; ServerPe envelope. Never throws (DB errors → 500).
 * BENEFIT: One source of truth for GST; inclusive pricing stays consistent across UI + invoice.
 *
 * @returns {Promise<{statuscode:number, successstatus:boolean, message:string, data?:any[]}>}
 */
const getGSTValue = async () => {
  try {
    const result = await pool.query(
      `select gst_percent, description from gst_percents where is_active=true;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: "GST value details fetched successfully",
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching offers. Error: ${err.message}`,
    };
  }
};

module.exports = getGSTValue;
