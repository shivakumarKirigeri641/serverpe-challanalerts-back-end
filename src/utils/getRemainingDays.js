const getRemainingDays = (expiry_date) => {
  const today = new Date();
  const expiry = new Date(expiry_date);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};
module.exports = getRemainingDays;
