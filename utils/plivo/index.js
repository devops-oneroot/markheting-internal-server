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

function getISTDateRange() {
  const now = new Date();
  const istOffsetMinutes = 330;

  const istNow = new Date(now.getTime() + istOffsetMinutes * 60000);
  const istMidnight = new Date(istNow);
  istMidnight.setHours(0, 0, 0, 0);

  const utcToday = new Date(istMidnight.getTime() - istOffsetMinutes * 60000);
  const utcTomorrow = new Date(utcToday);
  utcTomorrow.setDate(utcTomorrow.getDate() + 1);

  return { istToday: utcToday, istTomorrow: utcTomorrow };
}
