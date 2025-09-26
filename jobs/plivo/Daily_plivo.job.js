import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "../../model/plivo-job-report.model.js";
import fetch from "node-fetch";

dotenv.config();

// --- Constants ---
const {
  PLIVO_SOURCE_NUMBER = "+918035737570",
  PLIVO_AUTH_ID = "MANDBHYTBKNMY1YWVIMM",
  PLIVO_AUTH_TOKEN = "NzE3MmU5NjkyYWUxMGQyODFkMWY1NWRmZTE3M2Nj",
  MONGO_URI,
  MAX_RECENT_REPORTS = "2",
  ANSWER_URL = "https://markheting-internal-server.onrender.com/plivo/answer",
  HEALTH_URL = "https://markheting-internal-server.onrender.com/health",
  FARMERS_API_URL = "https://markhet-internal-ngfs.onrender.com/crop/rth/number",
} = process.env;

const MAX_REPORTS = parseInt(MAX_RECENT_REPORTS, 10);

// ✅ Target crops (can be expanded easily later)
const TARGET_CROPS = ["tender coconut", "maize"];

// --- Global Plivo Client ---
let plivoClient;

// --- Init Plivo ---
function initPlivo() {
  if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN) {
    throw new Error("Plivo credentials missing");
  }
  plivoClient = new plivo.Client(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);
  console.info("✅ Plivo initialized");
}

// --- Connect Mongo ---
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

// --- Warmup Check ---
async function waitUntilWarm(url, retries = 12, delay = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return console.info("🔥 Backend warm"), true;
    } catch (_) {}
    console.warn(`⏳ Warmup attempt ${i + 1}/${retries}`);
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("Backend did not warm up in time");
}

// --- Fetch Farmers ---
async function fetchFarmers() {
  const res = await fetch(FARMERS_API_URL);
  if (!res.ok) throw new Error(`Farmers API failed: ${res.status}`);

  const data = await res.json();
  const list = data.data?.maybe_ready || [];

  return list
    .map(({ phoneNumber, cropname }) => ({
      phoneNumber,
      cropname: cropname?.toLowerCase()?.trim(),
    }))
    .filter((f) => f.phoneNumber && f.cropname);
}

// --- Recently Contacted Farmers ---
async function getRecentFarmers() {
  const reports = await PlivoReport.find()
    .sort({ createdAt: -1 })
    .limit(MAX_REPORTS);

  const set = new Set();
  for (const r of reports) {
    for (const entry of r.campaign_report || []) {
      set.add(`+${entry.number}-${entry.cropname}`);
    }
  }
  return set;
}

// --- Place Call ---
async function placeCall(phoneNumber, cropname, reportId) {
  const callUrl = `${ANSWER_URL}?reportId=${reportId}&cropName=${encodeURIComponent(
    cropname
  )}&label=Daily_RTH`;

  const res = await plivoClient.calls.create(
    PLIVO_SOURCE_NUMBER,
    phoneNumber,
    callUrl,
    { method: "GET" }
  );
  console.info(
    `📞 Call to farmer ${phoneNumber} (${cropname}) | UUID: ${res.requestUuid}`
  );
}

// --- Campaign Runner ---
async function runCampaign() {
  const farmers = await fetchFarmers();
  if (!farmers.length) return console.warn("No farmers found");

  const recent = await getRecentFarmers();
  const eligible = farmers.filter(
    ({ phoneNumber, cropname }) =>
      TARGET_CROPS.includes(cropname) &&
      !recent.has(`+${phoneNumber}-${cropname}`)
  );

  if (!eligible.length) return console.info("No eligible farmers");

  const campaign = await PlivoReport.create({
    label: "Daily_RTH",
    campaign_date: new Date(),
    campaign_report: [],
    calls_placed: eligible.length,
  });

  for (const { phoneNumber, cropname } of eligible) {
    try {
      await placeCall(phoneNumber, cropname, campaign._id.toString());
      await new Promise((r) => setTimeout(r, 1000)); // throttle
    } catch (err) {
      console.error(`❌ Failed call to farmer ${phoneNumber}: ${err.message}`);
    }
  }

  console.info("✅ Farmer campaign done");
}

// --- Entrypoint ---
(async function main() {
  try {
    initPlivo();
    await connectMongo();
    await waitUntilWarm(HEALTH_URL);
    await runCampaign();
    process.exit(0);
  } catch (err) {
    console.error(`❌ Fatal: ${err.message}`);
    process.exit(1);
  }
})();
