import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "../../model/plivo-job-report.model.js";
import fetch from "node-fetch";

// Load environment variables
dotenv.config();

// Constants
const SOURCE_NUMBER = process.env.PLIVO_SOURCE_NUMBER;
const ANSWER_URL =
  process.env.PLIVO_ANSWER_URL || "https://campdash.onrender.com/plivo/answer";
const FARMERS_API_URL =
  process.env.FARMERS_API_URL || "http://localhost:3002/crop/rth/number";
const MONGO_URI = process.env.MONGO_URI;
const MAX_RECENT_REPORTS = process.env.MAX_RECENT_REPORTS || 2;

// Plivo client reference
let plivoClient = null;

/**
 * Initialize Plivo client with credentials
 */
function initializePlivoClient() {
  try {
    if (!process.env.PLIVO_AUTH_ID || !process.env.PLIVO_AUTH_TOKEN) {
      throw new Error("Plivo credentials missing in environment variables");
    }

    plivoClient = new plivo.Client(
      process.env.PLIVO_AUTH_ID,
      process.env.PLIVO_AUTH_TOKEN
    );

    console.info("✅ Plivo client initialized");
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Plivo client: ${error.message}`);
    return false;
  }
}

/**
 * Connect to MongoDB database
 */
async function connectMongo() {
  try {
    if (!MONGO_URI) {
      throw new Error("MongoDB URI is missing in environment variables");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.info("✅ MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    return false;
  }
}

/**
 * Fetch farmers/buyers data from API
 */
async function fetchBuyers() {
  try {
    const response = await fetch(FARMERS_API_URL);
    if (!response.ok) throw new Error(`API error! Status: ${response.status}`);

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid data format received from API");
    }

    const buyers = data.data
      .map(({ phoneNumber, cropname }) => ({
        phoneNumber,
        cropname: cropname?.toLowerCase?.().trim() || "",
      }))
      .filter((b) => b.phoneNumber && b.cropname);

    console.info(`✅ Fetched ${buyers.length} buyers from API`);
    return buyers;
  } catch (error) {
    console.error(`❌ Failed to fetch buyers: ${error.message}`);
    return [];
  }
}

/**
 * Get set of recently contacted farmers
 */
async function getRecentlyContactedFarmers() {
  try {
    const recentReports = await PlivoReport.find()
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_REPORTS);

    const reportedSet = new Set();
    recentReports.forEach((report) => {
      if (report.campaign_report?.length) {
        report.campaign_report.forEach((entry) => {
          const key = `+${entry.number}-${entry.cropname
            ?.toLowerCase?.()
            .trim()}`;
          reportedSet.add(key);
        });
      }
    });

    console.info(`✅ Found ${reportedSet.size} recently contacted farmers`);
    return reportedSet;
  } catch (error) {
    console.error(
      `❌ Failed to get recently contacted farmers: ${error.message}`
    );
    return new Set();
  }
}

/**
 * Place a call to a farmer
 */
async function placeCall(phoneNumber, cropname, reportId) {
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
    `✅ Call placed to ${phoneNumber} for ${cropname} | UUID: ${response.requestUuid}`
  );
  return response;
}

/**
 * Main campaign execution
 */
export async function runPlivoCampaign() {
  console.info("🚀 Running Plivo campaign...");

  const buyers = await fetchBuyers();
  if (!buyers.length) return console.warn("No buyers found");

  const reportedSet = await getRecentlyContactedFarmers();
  const eligible = buyers.filter(
    ({ phoneNumber, cropname }) =>
      !reportedSet.has(`+${phoneNumber}-${cropname}`)
  );

  console.info(`✅ ${eligible.length} farmers eligible`);
  if (!eligible.length) return console.info("No new farmers to call");

  const campaign = await PlivoReport.create({
    label: "Daily_RTH",
    campaign_date: new Date(),
    campaign_report: [],
  });
  const reportId = campaign._id.toString();
  console.info(`✅ Campaign created: ${reportId}`);

  for (const { phoneNumber, cropname } of eligible) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await placeCall(phoneNumber, cropname, reportId);
    } catch {}
  }

  console.info("✅ Campaign complete");
}

/**
 * Application entrypoint
 */
async function main() {
  console.info("🔄 Initializing service");

  if (!initializePlivoClient()) process.exit(1);
  if (!(await connectMongo())) process.exit(1);

  // Execute campaign immediately
  await runPlivoCampaign();
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err.message}`);
  process.exit(1);
});
