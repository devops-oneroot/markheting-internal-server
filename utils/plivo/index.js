// utils/getTodayCampaign.js
import PlivoReport from "../../model/plivo-job-report.model.js";

export async function getTodayCampaign() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const istNowMs = now.getTime() + istOffset * 60 * 1000;
  const istToday = new Date(istNowMs);
  istToday.setHours(0, 0, 0, 0);
  const istTomorrow = new Date(istToday);
  istTomorrow.setDate(istTomorrow.getDate() + 1);

  return PlivoReport.findOne({
    campaign_date: { $gte: istToday, $lt: istTomorrow },
  });
}

export function getISTDateRange() {
  const now = new Date();

  // Get IST offset in minutes (+5:30 = 330)
  const istOffsetMinutes = 330;

  // Convert to IST
  const istNow = new Date(now.getTime() + istOffsetMinutes * 60000);

  // Get IST midnight today
  const istMidnight = new Date(istNow);
  istMidnight.setHours(0, 0, 0, 0);

  // Convert IST midnight today to UTC
  const utcToday = new Date(istMidnight.getTime() - istOffsetMinutes * 60000);

  // IST midnight tomorrow
  const istTomorrowMidnight = new Date(istMidnight);
  istTomorrowMidnight.setDate(istTomorrowMidnight.getDate() + 1);

  // Convert to UTC
  const utcTomorrow = new Date(
    istTomorrowMidnight.getTime() - istOffsetMinutes * 60000
  );

  return { istToday: utcToday, istTomorrow: utcTomorrow };
}
