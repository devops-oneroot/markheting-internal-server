//helper function
function getISTDateRange() {
  const now = new Date();

  // Convert to IST by using toLocaleString in Asia/Kolkata
  const istNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  // Get IST midnight today
  const istToday = new Date(istNow);
  istToday.setHours(0, 0, 0, 0);

  // Get IST midnight tomorrow
  const istTomorrow = new Date(istToday);
  istTomorrow.setDate(istTomorrow.getDate() + 1);

  return { istToday, istTomorrow };
}