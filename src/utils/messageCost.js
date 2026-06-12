/**
 * Per-message cost (₹) by channel — used to populate message_logs.cost so the
 * total spend on notifications is queryable. Update here if the rates change
 * (historical rows keep the cost they were logged with).
 */
const MESSAGE_COST = {
  WHATSAPP: 0.118,
  SMS: 0.25,
  EMAIL: 0,
};

/** Cost for a channel; 0 when the message was not actually sent. */
const costFor = (channel, sent = true) =>
  sent ? (MESSAGE_COST[String(channel || "").toUpperCase()] ?? 0) : 0;

module.exports = { MESSAGE_COST, costFor };
