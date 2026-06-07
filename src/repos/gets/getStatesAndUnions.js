const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
const axios = require("axios");
require("dotenv").config();
const getStatesAndUnions = async () => {
  try {
    const result = await pool.query(
      `SELECT id, state_union_code, rto_code, state_union_name, is_union_territory from states_unions where
      is_active=true order by state_union_name;`,
    );
    //test whatsapp
    /*const response = await axios.post(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: `91900970271`,
        type: "template",
        template: {
          name: "amv_welcome_v1",
          language: {
            code: "en",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: `Amruta`,
                },
                {
                  type: "text",
                  text: `KA32R8604`,
                },
                {
                  type: "text",
                  text: `06-07-2026`,
                },
              ],
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

    console.log("WhatsApp Sent:", response.data);*/
    return {
      statuscode: 200,
      successstatus: true,
      message: "States/unions fetched successfully",
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

module.exports = getStatesAndUnions;
