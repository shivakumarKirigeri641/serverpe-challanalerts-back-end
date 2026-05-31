const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

const postContactMe = async (
  user_name,
  mobile_number,
  query_type_name,
  message,
  email = null,
) => {
  try {
    await pool.query("BEGIN");
    let result_query_typesdetails = await pool.query(
      `select *from query_types where title=$1 and is_active=true`,
      [query_type_name],
    );
    // Unknown/empty topic → fall back to the general type, then to any active
    // type, so we never crash on a missing row.
    if (0 === result_query_typesdetails.rows.length) {
      result_query_typesdetails = await pool.query(
        `select *from query_types where code='GENERAL' and is_active=true`,
      );
    }
    if (0 === result_query_typesdetails.rows.length) {
      result_query_typesdetails = await pool.query(
        `select *from query_types where is_active=true order by id limit 1`,
      );
    }
    if (0 === result_query_typesdetails.rows.length) {
      await pool.query("ROLLBACK");
      return {
        statuscode: 500,
        successstatus: false,
        message: "No active query types configured",
      };
    }
    const result = await pool.query(
      `INSERT INTO contact_me (fk_query_types, name, mobile_number, email, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [
        result_query_typesdetails.rows[0].id,
        user_name,
        mobile_number,
        email ? email : null,
        message,
      ],
    );
    await pool.query("COMMIT");
    //alert here admin abot contacting me
    return {
      statuscode: 200,
      successstatus: true,
      message: "Contact details posted successfully",
      data: result.rows[0],
    };
  } catch (err) {
    await pool.query("ROLLBACK");
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error in Contact details post. Error: ${err.message}`,
    };
  }
};
module.exports = postContactMe;
