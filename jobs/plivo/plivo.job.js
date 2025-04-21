import cron from "node-cron";
import plivo from "plivo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import PlivoReport from "./../../model/plivo-job-report.model.js";
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
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "53 18 * * *"; // 11:15 AM IST daily
const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";
const MAX_RECENT_REPORTS = process.env.MAX_RECENT_REPORTS || 2;

// Plivo client setup
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
 * @returns {Promise<boolean>} Connection success status
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
 * @returns {Promise<Array>} Array of buyers with phone numbers and crop names
 */
async function fetchBuyers() {
  try {
    const response = await fetch(FARMERS_API_URL);

    if (!response.ok) {
      throw new Error(`API error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid data format received from API");
    }

    const buyers = data.data
      .map(({ phoneNumber, cropname }) => ({
        phoneNumber,
        cropname: cropname?.toLowerCase?.().trim() || "",
      }))
      .filter((buyer) => buyer.phoneNumber && buyer.cropname);

    console.info(`✅ Fetched ${buyers.length} buyers from API`);
    return buyers;
  } catch (error) {
    console.error(`❌ Failed to fetch buyers: ${error.message}`);
    return [];
  }
}

/**
 * Get set of recently contacted farmers
 * @returns {Promise<Set>} Set of unique farmer identifiers
 */
async function getRecentlyContactedFarmers() {
  try {
    const recentReports = await PlivoReport.find()
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_REPORTS);

    const reportedSet = new Set();

    recentReports.forEach((report) => {
      if (report.campaign_report?.length > 0) {
        report.campaign_report.forEach((entry) => {
          // Create a unique key combining phone number and crop name
          const key = `${entry.number ? `+${entry.number}` : ""}-${
            entry.cropname?.toLowerCase?.().trim() || ""
          }`;
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
 * @param {string} phoneNumber - Farmer's phone number
 * @param {string} cropname - Crop name
 * @param {string} reportId - Campaign report ID
 * @returns {Promise<object>} Call response
 */
async function placeCall(phoneNumber, cropname, reportId) {
  try {
    if (!plivoClient) {
      throw new Error("Plivo client not initialized");
    }

    const callUrl = `${ANSWER_URL}?reportId=${reportId}&cropName=${encodeURIComponent(
      cropname
    )}`;

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
  } catch (error) {
    console.error(
      `❌ Call failed to ${phoneNumber} for ${cropname}: ${error.message}`
    );
    throw error;
  }
}

/**
 * Main campaign execution function
 */
export async function runPlivoCampaign() {
  console.info("🚀 Starting Plivo campaign execution");

  try {
    // Step 1: Fetch buyers from API
    const buyers = await fetchBuyers();
    if (!buyers.length) {
      console.warn("No buyers found to contact");
      return;
    }

    // Step 2: Get recently contacted farmers
    const reportedSet = await getRecentlyContactedFarmers();

    // Step 3: Filter out buyers who have been recently contacted
    const eligibleFarmers = buyers.filter(({ phoneNumber, cropname }) => {
      const key = `${phoneNumber}-${cropname}`;
      return !reportedSet.has(key);
    });

    console.info(
      `✅ Found ${eligibleFarmers.length} eligible farmers to contact`
    );

    // Step 4: Create new campaign if we have eligible farmers
    if (eligibleFarmers.length > 0) {
      const campaign = await PlivoReport.create({
        campaign_date: new Date(),
        campaign_report: [],
      });

      const reportId = campaign._id.toString();
      console.info(`✅ Created new campaign with ID: ${reportId}`);

      // Step 5: Place calls to each eligible farmer
      const callPromises = [];
      for (const { phoneNumber, cropname } of eligibleFarmers) {
        // Add delay between calls to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          const callPromise = placeCall(phoneNumber, cropname, reportId);
          callPromises.push(callPromise);
        } catch (error) {
          // Individual call errors are already logged in placeCall
          continue;
        }
      }

      // Wait for all calls to be processed
      await Promise.allSettled(callPromises);
      console.info(`✅ Campaign execution completed`);
    } else {
      console.info("🟡 No new farmers to call in this campaign");
    }
  } catch (error) {
    console.error(`❌ Campaign execution failed: ${error.message}`);
  }
}

/**
 * Initialize application
 */
async function initialize() {
  console.info("🔄 Initializing Plivo Campaign Service");

  // Initialize Plivo client
  const plivoInitialized = initializePlivoClient();
  if (!plivoInitialized) {
    console.error(
      "❌ Application initialization failed: Plivo client not initialized"
    );
    process.exit(1);
  }

  // Connect to MongoDB
  const mongoConnected = await connectMongo();
  if (!mongoConnected) {
    console.error(
      "❌ Application initialization failed: MongoDB connection failed"
    );
    process.exit(1);
  }

  // Schedule the cron job
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron schedule: ${CRON_SCHEDULE}`);
    process.exit(1);
  }

  cron.schedule(
    CRON_SCHEDULE,
    async () => {
      console.info(
        `⏰ Executing scheduled campaign at ${new Date().toISOString()}`
      );
      try {
        await runPlivoCampaign();
      } catch (error) {
        console.error(
          `❌ Scheduled campaign execution failed: ${error.message}`
        );
      }
    },
    {
      timezone: TIMEZONE,
      scheduled: true,
    }
  );

  console.info(`⏰ Cron job scheduled: ${CRON_SCHEDULE} (${TIMEZONE})`);

  // Run the campaign immediately on startup if needed
  // Uncomment the following line if you want to run the campaign on startup
  // await runPlivoCampaign();
}

// Start the application
initialize().catch((error) => {
  console.error(`❌ Application failed to start: ${error.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
