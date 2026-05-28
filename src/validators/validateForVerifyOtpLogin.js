const validator = require("validator");

const err = (message) => ({
  statuscode: 400,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

const isNonEmptyString = (v) =>
  typeof v === "string" && v.trim().length > 0;

const validateForVerifyOtpLogin = (req) => {
  try {
    const mobile_number = req?.body?.mobile_number;
    const user_name = req?.body?.user_name;
    const otp = req?.body?.otp;
    const email = req?.body?.email;
    const address = req?.body?.address || {};

    if (!mobile_number) return err("mobile_number is required");
    if (!otp) return err("otp is required");

    // Mobile — normalize and validate.
    const cleanedMobile = mobile_number
      .toString()
      .replace(/\s+/g, "")
      .replace(/^(\+91|91)/, "");
    if (!/^[6-9]\d{9}$/.test(cleanedMobile)) {
      return err("Invalid mobile number format");
    }

    // OTP — strictly 4 digits.
    const cleanedOtp = String(otp).trim();
    if (!/^\d{4}$/.test(cleanedOtp)) {
      return err("OTP must be 4 digits");
    }

    // User name — required, 2-80 chars, letters/spaces/dots/apostrophes/hyphens.
    if (!isNonEmptyString(user_name)) return err("user_name is required");
    const cleanedName = user_name.trim().replace(/\s+/g, " ");
    if (cleanedName.length < 2 || cleanedName.length > 80) {
      return err("user_name must be between 2 and 80 characters");
    }
    if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(cleanedName)) {
      return err("user_name contains invalid characters");
    }

    // Email — optional, but if provided must be valid.
    let cleanedEmail = null;
    if (email !== undefined && email !== null && String(email).trim() !== "") {
      const candidate = String(email).trim();
      if (!validator.isEmail(candidate)) return err("Invalid email format");
      cleanedEmail = validator.normalizeEmail(candidate) || candidate;
    }

    // Address — mandatory: state_union_id, house_flat_no, address_line1, pincode, city, district.
    //           optional: address_line2, area, landmark, map_location.
    const {
      id: address_id,
      state_union_id,
      house_flat_no,
      address_line1,
      address_line2,
      area,
      landmark,
      pincode,
      city,
      district,
      map_location,
    } = address;

    // id — optional. When present, signals an UPDATE to an existing saved address
    // (the user picked one from the saved-addresses popup). When absent/null, a new
    // address row is inserted.
    let cleanedAddressId = null;
    if (address_id !== undefined && address_id !== null && address_id !== "") {
      const n = Number(address_id);
      if (!Number.isInteger(n) || n <= 0) {
        return err("address.id must be a positive integer");
      }
      cleanedAddressId = n;
    }

    // state_union_id — required, must be a positive integer (id from states_unions table,
    // populated when user selects a state/UT from the dropdown or via map location).
    if (state_union_id === undefined || state_union_id === null || state_union_id === "") {
      return err("address.state_union_id is required");
    }
    const cleanedStateUnionId = Number(state_union_id);
    if (!Number.isInteger(cleanedStateUnionId) || cleanedStateUnionId <= 0) {
      return err("address.state_union_id must be a positive integer");
    }

    if (!isNonEmptyString(house_flat_no)) return err("address.house_flat_no is required");
    if (!isNonEmptyString(address_line1)) return err("address.address_line1 is required");
    if (!isNonEmptyString(city)) return err("address.city is required");
    if (!isNonEmptyString(district)) return err("address.district is required");
    if (!isNonEmptyString(pincode)) return err("address.pincode is required");

    const cleanedPincode = String(pincode).replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanedPincode)) {
      return err("address.pincode must be a 6-digit number");
    }

    const trim = (v, max) => String(v).trim().replace(/\s+/g, " ").slice(0, max);
    const cleanedHouseFlatNo = trim(house_flat_no, 50);
    const cleanedAddressLine1 = trim(address_line1, 150);
    const cleanedAddressLine2 = isNonEmptyString(address_line2) ? trim(address_line2, 150) : null;
    const cleanedArea = isNonEmptyString(area) ? trim(area, 100) : null;
    const cleanedLandmark = isNonEmptyString(landmark) ? trim(landmark, 100) : null;
    const cleanedCity = trim(city, 80);
    const cleanedDistrict = trim(district, 80);

    // map_location — optional text (e.g. "lat,lng" or display text).
    let cleanedMapLocation = null;
    if (map_location !== undefined && map_location !== null && map_location !== "") {
      if (typeof map_location !== "string") {
        return err("address.map_location must be text");
      }
      cleanedMapLocation = map_location.trim().slice(0, 250);
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Validation successful",
      data: {
        mobile_number: cleanedMobile,
        otp: cleanedOtp,
        user_name: cleanedName,
        email: cleanedEmail,
        address: {
          id: cleanedAddressId,
          state_union_id: cleanedStateUnionId,
          house_flat_no: cleanedHouseFlatNo,
          address_line1: cleanedAddressLine1,
          address_line2: cleanedAddressLine2,
          area: cleanedArea,
          landmark: cleanedLandmark,
          pincode: cleanedPincode,
          city: cleanedCity,
          district: cleanedDistrict,
          map_location: cleanedMapLocation,
        },
      },
    };
  } catch (error) {
    console.error("verify-otp-login validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateForVerifyOtpLogin;
