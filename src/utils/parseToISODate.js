// The external IDS APIs return dates as "DD-MM-YYYY" (optionally with a time
// suffix, e.g. "30-05-2026" or "30-05-2026 14:35:00"). Postgres reads such a
// value with its default MDY DateStyle and rejects it ("date/time field value
// out of range") because the first part (the day) is treated as the month.
// Normalize these strings to ISO "YYYY-MM-DD[ HH:MM:SS]" before inserting.
const parseToISODate = (value) => {
  if (value === null || value === undefined) return null;

  const str = String(value).trim();
  if (str === "" || str.toUpperCase() === "NA" || str === "-") return null;

  // Split off an optional time portion.
  const [datePart, ...timeParts] = str.split(/[ T]/);
  const timePart = timeParts.join(" ").trim();

  // Match DD-MM-YYYY or DD/MM/YYYY.
  const match = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) {
    // Not in the expected DD-MM-YYYY shape; assume it is already a value
    // Postgres can parse (e.g. ISO "YYYY-MM-DD") and pass it through.
    return str;
  }

  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return timePart ? `${iso} ${timePart}` : iso;
};

module.exports = parseToISODate;
