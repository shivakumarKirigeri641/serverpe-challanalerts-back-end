/**
 * Indian number-plate normalization + validation, shared by all validators so
 * the same physical vehicle always maps to one canonical reg_no.
 *
 *  - Modern:  SS DD L(1-3) NNNN   e.g. KA01AB1234
 *             The trailing number is zero-padded to 4 digits, so KA01AB1 and
 *             KA01AB01 both canonicalize to KA01AB0001.
 *  - BH:      YY BH NNNN L(1-2)   e.g. 22BH1234AA (already 4 digits — left as-is)
 *  - Older:   2-3 letters + 1-4 digits  e.g. MYE368, MYK7503 (left as-is)
 */

const STANDARD_PLATE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
const BH_PLATE = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
const OLD_PLATE = /^[A-Z]{2,3}[0-9]{1,4}$/;

// Modern plate split as <prefix><trailing number> so the number can be padded.
const MODERN_SPLIT = /^([A-Z]{2}[0-9]{1,2}[A-Z]{1,3})([0-9]{1,4})$/;

/** Uppercase, strip spaces/hyphens, and zero-pad a modern plate's number to 4. */
function normalizePlate(input) {
  const v = String(input || "")
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  const m = v.match(MODERN_SPLIT);
  if (m) return m[1] + m[2].padStart(4, "0");
  return v; // BH and older plates: cleaned only, no padding
}

/** True if the (normalized) value is a recognised modern, BH or older plate. */
function isValidPlate(input) {
  const v = normalizePlate(input);
  return STANDARD_PLATE.test(v) || BH_PLATE.test(v) || OLD_PLATE.test(v);
}

module.exports = {
  normalizePlate,
  isValidPlate,
  STANDARD_PLATE,
  BH_PLATE,
  OLD_PLATE,
};
