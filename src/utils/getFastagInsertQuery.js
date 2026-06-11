const parseToISODate = require("./parseToISODate");
const getFastagInsertQuery = (id, data) => {
  const myqueryft = `
        INSERT INTO fastag_details (
            fk_rc_details,            
            fastag_id,
            status,
            bank_name,
            customer_name,
            balance,
            issued_date
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7
        ) returning *
    `;

  const valuesft = [
    id,
    data.fastagId,
    data.status,
    data.bankName,
    data.customerName,
    data.balance,
    parseToISODate(data.issuedDate),
  ];

  return {
    myqueryft,
    valuesft,
  };
};
module.exports = getFastagInsertQuery;
