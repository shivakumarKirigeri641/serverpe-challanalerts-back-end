const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/* WhatsApp (Meta) is POST-PAID — there is no prepaid balance to deplete; each
   message simply accrues ₹0.118. That spend is captured in message_logs.cost
   (via costFor) and surfaced in admin analytics, so nothing is billed here. */

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
const smsFallbackPlaceholder = async ({
  mobile_number,
  template,
  params = [],
}) => {
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
              // WhatsApp rejects blank body params — coalesce empties to "N/A".
              parameters: params.map((text) => {
                const v = text == null ? "" : String(text).trim();
                return { type: "text", text: v === "" ? "N/A" : v };
              }),
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
        typeof onSmsFallback === "function"
          ? onSmsFallback
          : smsFallbackPlaceholder;
      await fallback({ mobile_number, template, params, error });
    } catch (smsErr) {
      console.error("SMS fallback also failed:", smsErr?.message || smsErr);
    }
    return { ok: false, channel: "sms", error };
  }
};

/**
 * Upload a local file to the WhatsApp Media API and return its media id.
 * Uses Node's global FormData/Blob (Node 18+) so no extra dependency is needed.
 * The media id is valid for sending for a limited time (re-upload per send).
 *
 * @param {string} filePath   absolute or process-relative path to the file
 * @param {string} [mimeType] e.g. "application/pdf"
 * @returns {Promise<string>} the WhatsApp media id
 */
const uploadWhatsAppMedia = async (filePath, mimeType = "application/pdf") => {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const buffer = fs.readFileSync(abs);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([buffer], { type: mimeType }), path.basename(abs));

  const resp = await axios.post(
    `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
    form,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } },
  );
  return resp.data.id;
};

/**
 * Send an approved WhatsApp template that has a DOCUMENT header (PDF attachment)
 * plus ordered body params. The PDF is uploaded to WhatsApp first, then attached
 * by media id. Used for the VDH report ("amv_vdh_with_feedaackrequest_v1").
 *
 * Never throws — returns a small result object so a send failure can't break the
 * calling job. (No SMS fallback here: an SMS can't carry the PDF.)
 *
 * @param {object} p
 * @param {string}   p.mobile_number       cleaned 10-digit mobile
 * @param {string}   p.template            approved template name (has a document header)
 * @param {string[]} [p.params=[]]         ordered body params
 * @param {string}   p.documentPath        path to the PDF on disk
 * @param {string}   [p.documentFilename]  filename shown in WhatsApp
 * @param {string}   [p.languageCode="en"]
 * @returns {Promise<{ ok:boolean, channel:"whatsapp", data?:any, error?:any }>}
 */
const sendWhatsAppDocumentTemplate = async ({
  mobile_number,
  template,
  params = [],
  documentPath,
  documentFilename = "report.pdf",
  languageCode = "en",
}) => {
  try {
    const mediaId = await uploadWhatsAppMedia(documentPath, "application/pdf");
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
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: { id: mediaId, filename: documentFilename },
                },
              ],
            },
            {
              type: "body",
              parameters: params.map((text) => {
                const v = text == null ? "" : String(text).trim();
                return { type: "text", text: v === "" ? "N/A" : v };
              }),
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
    console.log("WhatsApp document template sent:", response.data);
    return { ok: true, channel: "whatsapp", data: response.data };
  } catch (err) {
    const error = err?.response?.data || err.message;
    console.error(
      `WhatsApp document send failed (template "${template}"):`,
      error,
    );
    return { ok: false, channel: "whatsapp", error };
  }
};

module.exports = {
  sendWhatsApp,
  toWhatsAppNumber,
  sendWhatsAppDocumentTemplate,
  uploadWhatsAppMedia,
};
