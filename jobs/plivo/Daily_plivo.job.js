import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "../../model/plivo-job-report.model.js";
import fetch from "node-fetch";

dotenv.config();

// Constants
const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER || "+918035737570";
const ANSWER_URL =
  process.env.ANSWER_URL ||
  "https://markheting-internal-server.onrender.com/plivo/answer";
const HEALTH_URL =
  process.env.HEALTH_URL ||
  "https://markheting-internal-server.onrender.com/health"; // <-- health check endpoint
const FARMERS_API_URL =
  process.env.FARMERS_API_URL ||
  "https://markhet-internal-ngfs.onrender.com/crop/rth/number";
const MONGO_URI = process.env.MONGO_URI;
const MAX_RECENT_REPORTS = parseInt(process.env.MAX_RECENT_REPORTS || "2", 10);

// Plivo client reference
let plivoClient = null;

// Initialize Plivo client
function initializePlivoClient() {
  try {
    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    if (!authId || !authToken) throw new Error("Missing Plivo credentials");

    plivoClient = new plivo.Client(authId, authToken);
    console.info("✅ Plivo client initialized");
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Plivo client: ${error.message}`);
    return false;
  }
}

// Connect to MongoDB
async function connectMongo() {
  try {
    if (!MONGO_URI) throw new Error("MongoDB URI missing");

    await mongoose.connect(MONGO_URI);
    console.info("✅ MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    return false;
  }
}

// Wait until Render API is warm
async function waitUntilWarm(url, retries = 12, delay = 10000) {
  console.info("⏳ Checking if backend is warm...");
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        console.info("🔥 Backend is warm and ready!");
        return true;
      }
    } catch (err) {
      console.warn(`Waiting for warmup... attempt ${i + 1}/${retries}`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("❌ Backend did not warm up in time");
}

// Fetch buyers (maybe_ready farmers)
async function fetchBuyers() {
  try {
    const response = await fetch(FARMERS_API_URL);
    if (!response.ok) throw new Error(`API error! Status: ${response.status}`);

    const apiData = await response.json();
    const list = apiData.data?.maybe_ready;
    if (!Array.isArray(list))
      throw new Error("Invalid API response: no maybe_ready array");

    const buyers = list
      .map(({ phoneNumber, cropname }) => ({
        phoneNumber,
        cropname: cropname?.toLowerCase()?.trim() || "",
      }))
      .filter((b) => b.phoneNumber && b.cropname);

    console.info(`✅ Got ${buyers.length} maybe_ready buyers`);
    return buyers;
  } catch (error) {
    console.error(`❌ Failed to fetch buyers: ${error.message}`);
    return [];
  }
}

// Get recently contacted farmers
async function getRecentlyContactedFarmers() {
  try {
    const recentReports = await PlivoReport.find()
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_REPORTS);

    const reportedSet = new Set();
    for (const report of recentReports) {
      for (const entry of report.campaign_report || []) {
        reportedSet.add(
          `+${entry.number}-${entry.cropname?.toLowerCase()?.trim()}`
        );
      }
    }

    console.info(`✅ Found ${reportedSet.size} recently contacted farmers`);
    return reportedSet;
  } catch (error) {
    console.error(`❌ Error getting recent farmers: ${error.message}`);
    return new Set();
  }
}

// Place a call
async function placeCall(phoneNumber, cropname, reportId) {
  try {
    const callUrl = `${ANSWER_URL}?reportId=${reportId}&cropName=${encodeURIComponent(
      cropname
    )}&label=Daily_RTH`;
    const response = await plivoClient.calls.create(
      SOURCE_NUMBER,
      phoneNumber,
      callUrl,
      { method: "GET" }
    );
    console.info(
      `📞 Call placed to ${phoneNumber} (${cropname}) | UUID: ${response.requestUuid}`
    );
    return response;
  } catch (error) {
    console.error(`❌ Failed call to ${phoneNumber}: ${error.message}`);
    throw error;
  }
}

// Main campaign runner
export async function runPlivoCampaign() {
  console.info("🚀 Running Plivo campaign...");

  const buyers = await fetchBuyers();
  if (!buyers.length) return console.warn("No buyers fetched");

  const reportedSet = await getRecentlyContactedFarmers();
  const eligible = buyers.filter(
    ({ phoneNumber, cropname }) =>
      cropname === "tender coconut" &&
      !reportedSet.has(`+${phoneNumber}-${cropname}`)
  );

  console.info(`✅ ${eligible.length} eligible farmers`);
  if (!eligible.length) return;

  const campaign = await PlivoReport.create({
    label: "Daily_RTH",
    campaign_date: new Date(),
    campaign_report: [],
    calls_placed: eligible.length,
  });
  const reportId = campaign._id.toString();
  console.info(`📝 Campaign created: ${reportId}`);

  for (const { phoneNumber, cropname } of eligible) {
    await new Promise((r) => setTimeout(r, 1000)); // throttle
    try {
      await placeCall(phoneNumber, cropname, reportId);
    } catch {
      continue;
    }
  }

  console.info("✅ Campaign complete");
}

// Entrypoint
async function main() {
  console.info("🔄 Starting service...");
  if (!initializePlivoClient()) process.exit(1);
  if (!(await connectMongo())) process.exit(1);

  // ⏳ Ensure backend is warm before placing calls
  await waitUntilWarm(HEALTH_URL, 12, 10000);

  await runPlivoCampaign();
  process.exit(0); // keep if this is a cron job
}

main().catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
