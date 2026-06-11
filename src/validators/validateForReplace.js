const { normalizePlate, isValidPlate } = require("../utils/normalizePlate");

const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

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

    const rawOld = String(req?.body?.old_vehicle_number || "").trim();
    const rawNew = String(req?.body?.new_vehicle_number || "").trim();

    if (!rawOld) return err("old_vehicle_number is required");
    if (!rawNew) return err("new_vehicle_number is required");
    if (!isValidPlate(rawOld)) {
      return err(`Invalid vehicle number: ${req?.body?.old_vehicle_number}`);
    }
    if (!isValidPlate(rawNew)) {
      return err(`Invalid vehicle number: ${req?.body?.new_vehicle_number}`);
    }
    const oldVehicle = normalizePlate(rawOld);
    const newVehicle = normalizePlate(rawNew);
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
