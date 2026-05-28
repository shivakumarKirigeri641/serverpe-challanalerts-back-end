const getFastagInsertQuery = (data) => {
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
    data.fk_rc_details,
    data.fastag_id,
    data.status,
    data.bank_name,
    data.customer_name,
    data.balance,
    data.issued_date,
  ];

  return {
    myqueryft,
    valuesft,
  };
};
module.exports = getFastagInsertQuery;
