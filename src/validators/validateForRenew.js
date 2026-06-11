const { normalizePlate, isValidPlate } = require("../utils/normalizePlate");

const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

/**
 * Validates the renewal payload used by /renew/create-order and
 * /renew/verify-payment: a paid plan id and 1+ valid vehicle plates.
 * Returns cleaned { fk_subscription_plans, vehicle_numbers }.
 */
const validateForRenew = (req) => {
  try {
    const fk_subscription_plans = req?.body?.fk_subscription_plans;
    let vehicle_numbers = req?.body?.vehicle_numbers;

    const planId = Number(fk_subscription_plans);
    if (!Number.isInteger(planId) || planId <= 0) {
      return err("fk_subscription_plans is required");
    }

    if (typeof vehicle_numbers === "string") {
      vehicle_numbers = vehicle_numbers.split(",");
    }
    if (!Array.isArray(vehicle_numbers) || vehicle_numbers.length === 0) {
      return err("At least one vehicle_number is required");
    }

    const cleaned = [];
    for (const raw of vehicle_numbers) {
      if (!isValidPlate(raw)) {
        return err(`Invalid vehicle number: ${raw}`);
      }
      const v = normalizePlate(raw);
      if (cleaned.includes(v)) {
        return err(`Duplicate vehicle number: ${v}`);
      }
      cleaned.push(v);
    }

    // Optional: current vehicles to remove (disable) on a downgrade. Plates are
    // cleaned & validated; any that are also being covered are ignored.
    let remove_vehicle_numbers = req?.body?.remove_vehicle_numbers;
    if (typeof remove_vehicle_numbers === "string") {
      remove_vehicle_numbers = remove_vehicle_numbers.split(",");
    }
    const cleanedRemove = [];
    if (Array.isArray(remove_vehicle_numbers)) {
      for (const raw of remove_vehicle_numbers) {
        if (!String(raw || "").trim()) continue;
        if (!isValidPlate(raw)) {
          return err(`Invalid vehicle number: ${raw}`);
        }
        const v = normalizePlate(raw);
        if (!cleaned.includes(v) && !cleanedRemove.includes(v)) {
          cleanedRemove.push(v);
        }
      }
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Renewal payload validated",
      data: {
        fk_subscription_plans: planId,
        vehicle_numbers: cleaned,
        remove_vehicle_numbers: cleanedRemove,
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

module.exports = validateForRenew;
