import * as dotenv from "dotenv";
import fetch from "node-fetch";
import https from "https";
import Bottleneck from "bottleneck";
import { createUserWithFieldsAndFlow } from "./updatewhatsapp.js";

dotenv.config();

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
});

const limiter = new Bottleneck({
  maxConcurrent: 100,
  minTime: 10,
});

const FARMER_API_URL = "https://markhet-internal.onrender.com/users/farmer";

if (!FARMER_API_URL) {
  console.error("Error: FARMER_API_URL not set in .env");
  process.exit(1);
}

/**
 * Fetches farmer data, computes rthInDays, and calls ChatRace.
 */
async function main() {
  try {
    console.log(`Fetching farmers from ${FARMER_API_URL}`);
    const response = await fetch(FARMER_API_URL);
    const json = await response.json();
    const farmers = Array.isArray(json.data) ? json.data : [];

    for (const farmer of farmers) {
      const { name, village, taluk, district, mobileNumber } = farmer;

      // find first crop with nextHarvestDate
      const crop = (farmer.farms || [])
        .flatMap((f) => f.crops || [])
        .find((c) => c.nextHarvestDate);

      if (!crop) {
        console.log(`Skipping ${name}: no nextHarvestDate`);
        continue;
      }

      // calculate days to harvest
      const nextDate = new Date(crop.nextHarvestDate);
      const today = new Date();
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.ceil(
        (nextDate.getTime() - today.getTime()) / msPerDay
      );

      try {
        console.log(`Processing ${name}: rthInDays=${diffDays}`);
        const result = await createUserWithFieldsAndFlow({
          phone: mobileNumber,
          name,
          district,
          taluk,
          village,
          rthInDays: diffDays,
        });
        console.log(`Success for ${name}:`, result);
      } catch (err) {
        console.error(`Error for ${name}:`, err);
      }
    }

    console.log("All farmers processed.");
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

// run script
main();
