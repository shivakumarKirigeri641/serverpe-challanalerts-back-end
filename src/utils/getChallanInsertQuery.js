const parseToISODate = require("./parseToISODate");
const getChallanInsertQuery = (id, data) => {
  const myquerych = `
        INSERT INTO challan_details (
            fk_rc_details,
            challan_no,
            violator_name,
            state,
            challan_date,
            offence,
            penalty,
            challan_location,
            challan_amount,
            challan_status,
            rto_name,
            court_status,
            raw_response
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13
        ) returning id, challan_no, challan_date, offence, penalty, challan_location, challan_amount, rto_name, is_active;
    `;

  const valuesch = [
    id,
    data.challan_no,
    data.violator_name,
    data.state,
    parseToISODate(data.challan_date),
    data.offence,
    data.penalty,
    data.challan_location,
    data.challan_amount,
    data.challan_status,
    data.rto_name,
    data.court_status,
    data.raw_response || {},
  ];

  return {
    myquerych,
    valuesch,
  };
};
module.exports = getChallanInsertQuery;
