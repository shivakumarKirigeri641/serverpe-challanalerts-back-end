const STANDARD_PLATE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
const BH_PLATE = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

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
      const v = String(raw || "").toUpperCase().replace(/[\s-]+/g, "");
      if (!STANDARD_PLATE.test(v) && !BH_PLATE.test(v)) {
        return err(`Invalid vehicle number: ${raw}`);
      }
      if (cleaned.includes(v)) {
        return err(`Duplicate vehicle number: ${v}`);
      }
      cleaned.push(v);
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Renewal payload validated",
      data: { fk_subscription_plans: planId, vehicle_numbers: cleaned },
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
