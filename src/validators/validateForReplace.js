const STANDARD_PLATE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
const BH_PLATE = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

const cleanPlate = (raw) =>
  String(raw || "").toUpperCase().replace(/[\s-]+/g, "");
const isValidPlate = (v) => STANDARD_PLATE.test(v) || BH_PLATE.test(v);

/**
 * Validates the replace-vehicle payload used by /replace-vehicle/create-order
 * and /replace-vehicle/verify-payment: a replacement plan id, the old plate
 * being swapped out and the new plate swapped in.
 * Returns cleaned { fk_replacement_plan, old_vehicle_number, new_vehicle_number }.
 */
const validateForReplace = (req) => {
  try {
    const fk_replacement_plan = Number(req?.body?.fk_replacement_plan);
    if (!Number.isInteger(fk_replacement_plan) || fk_replacement_plan <= 0) {
      return err("fk_replacement_plan is required");
    }

    const oldVehicle = cleanPlate(req?.body?.old_vehicle_number);
    const newVehicle = cleanPlate(req?.body?.new_vehicle_number);

    if (!oldVehicle) return err("old_vehicle_number is required");
    if (!newVehicle) return err("new_vehicle_number is required");
    if (!isValidPlate(oldVehicle)) {
      return err(`Invalid vehicle number: ${req?.body?.old_vehicle_number}`);
    }
    if (!isValidPlate(newVehicle)) {
      return err(`Invalid vehicle number: ${req?.body?.new_vehicle_number}`);
    }
    if (oldVehicle === newVehicle) {
      return err("The new vehicle must be different from the old one");
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Replace payload validated",
      data: {
        fk_replacement_plan,
        old_vehicle_number: oldVehicle,
        new_vehicle_number: newVehicle,
      },
    };
  } catch (error) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForReplace;
