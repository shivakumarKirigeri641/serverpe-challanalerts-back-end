const axios = require("axios");
require("dotenv").config();

/**
 * Send an approved WhatsApp template message via the Meta (Facebook) Cloud API.
 *
 * Generic, low-level helper — callers pass the approved template name and its
 * ordered body parameters. Throws on failure so callers can fall back to SMS.
 *
 * @param {string} to            recipient in international format WITHOUT '+'
 *                               (e.g. "919876543210")
 * @param {string} templateName  approved template name (e.g. "amv_welcome_v1")
 * @param {string[]} bodyParams  ordered {{1}}, {{2}}, … body text values
 * @param {string} [languageCode="en"]
 */
const sendWhatsAppTemplate = async (
  to,
  templateName,
  bodyParams = [],
  languageCode = "en",
) => {
  const response = await axios.post(
    `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text })),
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
  return response.data;
};

/** Normalize a cleaned 10-digit Indian mobile to WhatsApp's "91XXXXXXXXXX". */
const toWhatsAppNumber = (mobile_number) =>
  `91${String(mobile_number).replace(/\D/g, "").replace(/^91/, "")}`;

module.exports = { sendWhatsAppTemplate, toWhatsAppNumber };
