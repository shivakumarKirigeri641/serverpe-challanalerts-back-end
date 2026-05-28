const getRCInsertQuery = (data) => {
  const myqueryrc = `
        INSERT INTO rc_details (
    fk_users,
    reg_no,
    owner_name,
    mobile_number,
    vehicle_manufacturer_name,
    model,
    fuel_type,
    vehicle_colour,
    vehicle_class,
    reg_date,
    rc_expiry_date,
    vehicle_insurance_company_name,
    vehicle_insurance_upto,
    pucc_upto,
    rto_code,
    vehicle_status,
    raw_response
)
VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,
    $10,$11,$12,$13,$14,$15,$16,$17
)
RETURNING
    id,
    reg_no,
    vehicle_manufacturer_name,
    model,
    fuel_type,
    vehicle_colour,
    vehicle_class,
    vehicle_insurance_upto,
    pucc_upto;
    `;

  const valuesrc = [
    data.fk_users,
    data.reg_no,
    data.owner_name,
    data.mobile_number,
    data.vehicle_manufacturer_name,
    data.model,
    data.fuel_type,
    data.vehicle_colour,
    data.vehicle_class,
    data.reg_date,
    data.rc_expiry_date,
    data.vehicle_insurance_company_name,
    data.vehicle_insurance_upto,
    data.pucc_upto,
    data.rto_code,
    data.vehicle_status,
    data.raw_response || {},
  ];

  return {
    myqueryrc,
    valuesrc,
  };
};
module.exports = getRCInsertQuery;
