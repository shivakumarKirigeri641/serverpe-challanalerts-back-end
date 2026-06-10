const parseToISODate = require("./parseToISODate");

/**
 * Builds an UPDATE for an existing rc_details row from a fresh external RC
 * payload (same `data` shape consumed by getRCInsertQuery). Refreshes ALL RC
 * fields and re-derives the cached remaining-days columns against today.
 *
 * fk_users / reg_no / id are NOT touched — the vehicle identity stays put; we
 * only refresh its details. Mirrors getRCInsertQuery column-for-column.
 *
 * @param {number} id   rc_details.id to update
 * @param {object} data external RC body (rc_external_details?.data?.data)
 * @returns {{ myqueryrcu: string, valuesrcu: any[] }}
 */
const getRCUpdateQuery = (id, data) => {
  const myqueryrcu = `
    UPDATE rc_details SET
        vehicle_class = $1,
        chassis = $2,
        engine = $3,
        vehicle_manufacturer_name = $4,
        model = $5,
        vehicle_colour = $6,
        fuel_type = $7,
        norms_type = $8,
        body_type = $9,
        owner_count = $10,
        owner_name = $11,
        owner_father_name = $12,
        vehicle_status = $13,
        status_as_on = $14,
        reg_authority = $15,
        reg_date = $16,
        vehicle_manufacturing_month_year = $17,
        rc_expiry_date = $18,
        vehicle_tax_upto = $19,
        vehicle_insurance_company_name = $20,
        vehicle_insurance_upto = $21,
        vehicle_insurance_policy_number = $22,
        rc_financer = $23,
        present_address = $24,
        permanent_address = $25,
        vehicle_cubic_capacity = $26,
        vehicle_cylinders_no = $27,
        vehicle_seat_capacity = $28,
        vehicle_standing_capacity = $29,
        wheelbase = $30,
        pucc_number = $31,
        pucc_upto = $32,
        blacklist_status = $33,
        permit_issue_date = $34,
        permit_number = $35,
        permit_type = $36,
        permit_valid_from = $37,
        permit_valid_upto = $38,
        non_use_status = $39,
        non_use_to = $40,
        national_permit_number = $41,
        national_permit_upto = $42,
        national_permit_issued_by = $43,
        is_commercial = $44,
        noc_details = $45,
        rto_code = $46,
        financed = $47,
        raw_response = $48,
        -- Re-derive remaining days = expiry date - today (NULL when absent).
        -- $18 = rc_expiry_date, $21 = vehicle_insurance_upto,
        -- $32 = pucc_upto, $42 = national_permit_upto.
        rc_expiry_remaining_datys =
          CASE WHEN $18::date IS NULL THEN NULL ELSE ($18::date - CURRENT_DATE) END,
        insurance_expiry_remaining_datys =
          CASE WHEN $21::date IS NULL THEN NULL ELSE ($21::date - CURRENT_DATE) END,
        pucc_expiry_remaining_datys =
          CASE WHEN $32::date IS NULL THEN NULL ELSE ($32::date - CURRENT_DATE) END,
        permit_days =
          CASE WHEN $42::date IS NULL THEN NULL ELSE ($42::date - CURRENT_DATE) END
    WHERE id = $49
    RETURNING
        id, reg_no, rc_expiry_date, vehicle_insurance_upto, pucc_upto,
        national_permit_upto, rc_expiry_remaining_datys,
        insurance_expiry_remaining_datys, pucc_expiry_remaining_datys, permit_days;
  `;

  const valuesrcu = [
    data.class || null,
    data.chassis || null,
    data.engine || null,
    data.vehicle_manufacturer_name || null,
    data.model || null,
    data.vehicle_colour || null,
    data.fuel_type || null,
    data.norms_type || null,
    data.body_type || null,
    data.owner_count || null,
    data.owner_name || null,
    data.owner_father_name || null,
    data.vehicle_status || null,
    parseToISODate(data.status_as_on),
    data.reg_authority || null,
    parseToISODate(data.reg_date),
    data.vehicle_manufacturing_month_year || null,
    parseToISODate(data.rc_expiry_date),
    parseToISODate(data.vehicle_tax_upto),
    data.vehicle_insurance_company_name || null,
    parseToISODate(data.vehicle_insurance_upto),
    data.vehicle_insurance_policy_number || null,
    data.rc_financer || null,
    data.present_address || null,
    data.permanent_address || null,
    data.vehicle_cubic_capacity || null,
    data.vehicle_cylinders_no || null,
    data.vehicle_seat_capacity || null,
    data.vehicle_standing_capacity || null,
    data.wheelbase || null,
    data.pucc_number || null,
    parseToISODate(data.pucc_upto),
    data.blacklist_status || null,
    parseToISODate(data.permit_issue_date),
    data.permit_number || null,
    data.permit_type || null,
    parseToISODate(data.permit_valid_from),
    parseToISODate(data.permit_valid_upto),
    data.non_use_status || null,
    parseToISODate(data.non_use_to),
    data.national_permit_number || null,
    parseToISODate(data.national_permit_upto),
    data.national_permit_issued_by || null,
    data.is_commercial || null,
    data.noc_details || null,
    data.rto_code || null,
    data.financed || null,
    data.raw_response || null,
    id,
  ];

  return { myqueryrcu, valuesrcu };
};

module.exports = getRCUpdateQuery;
