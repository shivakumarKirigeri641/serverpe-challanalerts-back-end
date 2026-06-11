/**
 * getStatesUnions — fetch active Indian states and union territories.
 *
 * Reads the `states_unions` table for active rows, ordered alphabetically
 * by `state_name`. Consumed by address-entry forms across the front-end.
 */

const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Retrieves the list of active states/union territories.
 *
 * @returns {Promise<Object>} Resolves to `{ successstatus: boolean, statuscode: number, powered_by: string, message: string, data?: Array<{ id: number, state_name: string, state_code: string, state_type: string }> }`.
 */
const getStatesUnions = async () => {
  try {
    // Active states and union territories
    const result = await pool.query(
      `select id, state_union_name, state_union_name, rto_code, country_name,is_union_territory from states_unions where is_active=true order by state_union_name;`,
    );
    return {
      statuscode: 201,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: `States/Unions fetch successfull.`,
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Failed to fetch States/Unions. Error:${err.message}`,
      data: result.rows,
    };
  }
};
module.exports = getStatesUnions;
