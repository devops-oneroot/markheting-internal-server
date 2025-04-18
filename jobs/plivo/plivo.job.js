import cron from "node-cron";
import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "./../../model/plivo-job-report.model.js";

dotenv.config();

// === Plivo Setup ===
const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);
const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER;
const ANSWER_URL = "https://campdash.onrender.com/plivo/answer";

// === DB Connection ===
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

// === Utility: Get IST Midnight in UTC ===
function getISTTodayInUTC() {
  const now = new Date();
  const istOffset = 330 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() - istOffset);
}

// === Main Campaign Logic ===
export async function runPlivoCampaign() {
  const todayUTC = getISTTodayInUTC();

  // ✅ Ensure one campaign per day
  const campaign = await PlivoReport.findOneAndUpdate(
    { campaign_date: todayUTC },
    {},
    { upsert: true, new: true }
  );

  const reportId = campaign.id;

  // 📞 Buyers to call
  const buyers = [
    { phoneNumber: "+917204408035", cropname: "tender coconut" },
    { phoneNumber: "+919900768505", cropname: "banana" },
  ];

  for (const { phoneNumber } of buyers) {
    try {
      const callUrl = `${ANSWER_URL}?reportId=${reportId}`;
      const resp = await client.calls.create(
        SOURCE_NUMBER,
        phoneNumber,
        callUrl,
        {
          method: "GET",
        }
      );
      console.log(`✅ Called ${phoneNumber} | UUID: ${resp.requestUuid}`);
    } catch (err) {
      console.error(
        `❌ Call failed to ${phoneNumber} | Reason: ${err.message}`
      );
    }
  }
}

// === Schedule: Every day at 11:15 AM IST ===
cron.schedule("15 11 * * *", () => runPlivoCampaign().catch(console.error), {
  timezone: "Asia/Kolkata",
});

console.log("⏰ Cron scheduled: Every day at 11:15 AM IST");

// === Start App ===
connectMongo().then(runPlivoCampaign);
