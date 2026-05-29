const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Resolves the stored PDF path for an invoice. The router streams the file.
 * @param {string} invoice_id  the business invoice id (invoices.invoice_id)
 */
const getInvoicePath = async (invoice_id) => {
  try {
    const result = await pool.query(
      `select invoice_id, invoice_path from invoices where invoice_id=$1`,
      [invoice_id],
    );
    if (result.rows.length === 0) {
      return { statuscode: 404, successstatus: false, message: "Invoice not found" };
    }
    return {
      statuscode: 200,
      successstatus: true,
      message: "Invoice found",
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching invoice. Error: ${err.message}`,
    };
  }
};

module.exports = getInvoicePath;
