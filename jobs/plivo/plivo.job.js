import cron from "node-cron";
import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "./../../model/plivo-job-report.model.js";
import { getISTDateRange } from "../../utils/plivo/index.js";

dotenv.config();

const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);
const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER;
const ANSWER_URL = "https://campdash.onrender.com/plivo/answer";

// MongoDB connection
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Exit if DB fails
  }
}

export async function runPlivoCampaign() {
  console.log(
    "🕚 Running campaign at",
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  );

  const { istToday } = getISTDateRange();

  // 1) Create a new campaign document for *today*
  const todayCampaign = await PlivoReport.create({ campaign_date: istToday });

  // 2) Your buyers list (replace with real fetch)
  const buyers = [
    { phoneNumber: "+917204408035", cropname: "tender coconut" },
    { phoneNumber: "+919900768505", cropname: "banana" },
  ];

  // 3) Dial each buyer
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
      console.error(`❌ Error calling ${phoneNumber}:`, err);
    }
  }
}

// Schedule daily at 11:15 AM IST
cron.schedule(
  "15 11 * * *",
  () => {
    runPlivoCampaign().catch(console.error);
  },
  { timezone: "Asia/Kolkata" }
);

console.log("⏰ Cron job scheduled: daily at 11:15 AM IST");

// ✅ Connect DB first, then run initial campaign manually (optional)
connectMongo().then(() => {
  runPlivoCampaign().then(() => console.log("✅ Initial campaign done"));
});
