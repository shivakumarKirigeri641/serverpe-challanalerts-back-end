const axios = require("axios");
require("dotenv").config();

/** Normalize a cleaned 10-digit Indian mobile to WhatsApp's "91XXXXXXXXXX". */
const toWhatsAppNumber = (mobile_number) =>
  `91${String(mobile_number).replace(/\D/g, "").replace(/^91/, "")}`;

/**
 * Default SMS fallback — PLACEHOLDER.
 *
 * Called when a WhatsApp send fails and the caller didn't pass its own
 * `onSmsFallback`. Receives the SAME `params` that were sent to WhatsApp (in the
 * same order) so the SMS can be built from them. Wire the appropriate fast2sms
 * template per message type here (or pass a message-specific `onSmsFallback`).
 */
const smsFallbackPlaceholder = async ({ mobile_number, template, params = [] }) => {
  // TODO: implement the SMS fallback — route to the right fast2sms template and
  // feed it `params` (same order as the WhatsApp body params).
  console.warn(
    `[SMS fallback TODO] WhatsApp failed for ${mobile_number} (template: "${template}", params: [${params.join(", ")}]). No SMS sent.`,
  );
};

/**
 * Common WhatsApp template sender (Meta / Facebook Cloud API).
 *
 * Pass the recipient + approved template + ordered body params. On ANY failure
 * it falls back to SMS: the caller's `onSmsFallback` if provided, otherwise the
 * placeholder above. Never throws — returns a small result object instead, so a
 * notification failure never breaks the calling flow.
 *
 * @param {object} p
 * @param {string}   p.mobile_number   cleaned 10-digit mobile (or 91XXXXXXXXXX)
 * @param {string}   p.template        approved template name (e.g. "amv_welcome_v1")
 * @param {string[]} [p.params=[]]     ordered {{1}}, {{2}}, … body text values
 * @param {string}   [p.languageCode="en"]
 * @param {function} [p.onSmsFallback] async ({ mobile_number, template, params, error }) => {}
 * @returns {Promise<{ ok: boolean, channel: "whatsapp"|"sms", data?: any, error?: any }>}
 */
const sendWhatsApp = async ({
  mobile_number,
  template,
  params = [],
  languageCode = "en",
  onSmsFallback,
}) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: toWhatsAppNumber(mobile_number),
        type: "template",
        template: {
          name: template,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text: String(text) })),
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    console.log("WhatsApp sent:", response.data);
    return { ok: true, channel: "whatsapp", data: response.data };
  } catch (err) {
    const error = err?.response?.data || err.message;
    console.error(`WhatsApp send failed (template "${template}"):`, error);
    try {
      const fallback =
        typeof onSmsFallback === "function" ? onSmsFallback : smsFallbackPlaceholder;
      await fallback({ mobile_number, template, params, error });
    } catch (smsErr) {
      console.error("SMS fallback also failed:", smsErr?.message || smsErr);
    }
    return { ok: false, channel: "sms", error };
  }
};

module.exports = { sendWhatsApp, toWhatsAppNumber };
