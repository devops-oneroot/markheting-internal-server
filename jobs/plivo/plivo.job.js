import cron from "node-cron";
import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "./../../model/plivo-job-report.model.js";

dotenv.config();

const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);

const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER;
const ANSWER_URL = "https://campdash.onrender.com/plivo/answer";

// 🔧 Utility to compute IST today and tomorrow in UTC
function getISTDateRange() {
  const now = new Date();
  const istOffsetMinutes = 330;

  const istNow = new Date(now.getTime() + istOffsetMinutes * 60000);

  const istMidnight = new Date(istNow);
  istMidnight.setHours(0, 0, 0, 0);

  const utcToday = new Date(istMidnight.getTime() - istOffsetMinutes * 60000);

  const istTomorrowMidnight = new Date(istMidnight);
  istTomorrowMidnight.setDate(istTomorrowMidnight.getDate() + 1);

  const utcTomorrow = new Date(
    istTomorrowMidnight.getTime() - istOffsetMinutes * 60000
  );

  return { istToday: utcToday, istTomorrow: utcTomorrow };
}

// ✅ MongoDB connection
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

// 🚀 Campaign Runner
export async function runPlivoCampaign() {
  console.log(
    "🕚 Running campaign at:",
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  );

  const { istToday } = getISTDateRange();

  console.log("📅 IST Today (UTC):", istToday.toISOString());

  // ✅ Ensure only one campaign per day
  let todayCampaign = await PlivoReport.findOne({ campaign_date: istToday });

  if (!todayCampaign) {
    todayCampaign = await PlivoReport.create({ campaign_date: istToday });
    console.log("🆕 Created new campaign document");
  } else {
    console.log("ℹ️ Campaign for today already exists");
  }

  // 🎯 Buyers to be called
  const buyers = [
    { phoneNumber: "+917204408035", cropname: "tender coconut" },
    { phoneNumber: "+919900768505", cropname: "banana" },
  ];

  for (const { phoneNumber } of buyers) {
    try {
      const resp = await client.calls.create(
        SOURCE_NUMBER,
        phoneNumber,
        ANSWER_URL,
        { method: "GET" }
      );
      console.log(`✅ Called ${phoneNumber}, UUID=${resp.requestUuid}`);
    } catch (err) {
      console.error(`❌ Failed to call ${phoneNumber}:`, err.message);
    }
  }
}

// 🕰️ Schedule cron job: Every day at 11:15 AM IST
cron.schedule(
  "15 11 * * *",
  () => {
    runPlivoCampaign().catch(console.error);
  },
  { timezone: "Asia/Kolkata" }
);

console.log("⏰ Cron job scheduled: every day at 11:15 AM IST");

// 🔌 Initial boot-up: connect DB and optionally trigger campaign once
connectMongo().then(() => {
  runPlivoCampaign().then(() => console.log("✅ Initial campaign completed"));
});
