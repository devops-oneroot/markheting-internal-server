import cron from "node-cron";
import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "./../../model/plivo-job-report.model.js";
import fetch from "node-fetch";

dotenv.config();

// === Plivo Setup ===
const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);
const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER;
const ANSWER_URL =
  process.env.PLIVO_ANSWER_URL || "https://campdash.onrender.com/plivo/answer";

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

// === Main Campaign Logic ===
export async function runPlivoCampaign() {
  // Timestamp campaign at run-time
  const now = new Date();

  // Always create a new campaign document
  const campaign = await PlivoReport.create({
    campaign_date: now,
    campaign_report: [],
  });

  const reportId = campaign._id.toString();

  // Fetch list of buyers from API using node-fetch
  let buyers = [];
  try {
    const response = await fetch(`http://localhost:3002/crop/rth/number`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    buyers = data.data.map(({ phoneNumber, cropname }) => ({
      phoneNumber,
      cropname,
    }));
    console.log("✅ Buyers fetched from API:", buyers);
  } catch (err) {
    console.error("❌ Failed to fetch buyers from API:", err.message);
    return; // Exit the function if buyers cannot be fetched
  }

  for (const { phoneNumber, cropname } of buyers) {
    const callUrl = `${ANSWER_URL}?reportId=${reportId}&cropName=${encodeURIComponent(
      cropname
    )}`;
    try {
      const resp = await client.calls.create(
        SOURCE_NUMBER,
        phoneNumber,
        callUrl,
        { method: "GET" }
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
connectMongo()
  .then(() => runPlivoCampaign())
  .catch(console.error);
