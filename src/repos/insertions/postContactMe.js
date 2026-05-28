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
      `select *from query_types where title=$1`,
      [query_type_name],
    );
    if (0 === result_query_typesdetails.rows.length) {
      result_query_typesdetails = await pool.query(
        `select *from query_types where title='General Query'`,
      );
    }
    const result = await pool.query(
      `INSERT INTO contact_me (query_type_id, user_name, mobile_number, email, message)
       VALUES ($1, $2, $3, $4,$5)
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
