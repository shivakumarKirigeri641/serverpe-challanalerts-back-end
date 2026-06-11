/**
 * Mint the next invoice id within the caller's transaction.
 *
 * Format: <prefix>-YYYYMMDD-NNNNNN, e.g. INV-20260602-000123 (subscriptions)
 * or INVR-20260602-000124 (replacements). The running number comes from the
 * `invoice_seq` Postgres sequence — nextval() is atomic and lock-free, so
 * concurrent renewals never collide (unlike the old `count(*)+1` scheme) and
 * never block each other. Numbers are globally monotonic (not reset per day);
 * gaps are possible and acceptable since each id is unique and time-stamped.
 *
 * @param {import('pg').PoolClient} client  the open transaction client
 * @param {string} prefix                   "INV" or "INVR"
 * @returns {Promise<string>} the new invoice id
 */
async function getNextInvoiceId(client, prefix) {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seqRes = await client.query("select nextval('invoice_seq') as n");
  const seq = String(seqRes.rows[0].n).padStart(6, "0");
  return `${prefix}-${yyyymmdd}-${seq}`;
}

module.exports = getNextInvoiceId;
