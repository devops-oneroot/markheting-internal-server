import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import AiBotCalls from "./model/aiBot.model.js";

const uri =
  "mongodb+srv://haidernadaf67:haider9900@cluster0.zokanwm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log(`✅ Connected to MongoDB at ${uri}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

async function importCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let parsedCount = 0;
  let skippedCount = 0;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      // Normalize and trim each field
      const record = {
        Date: (row.Date || row.date || "").trim(),
        From: (row.From || row.from || "").trim(),
        RecordingURL: (
          row.RecordingURL ||
          row.recordingUrl ||
          row.recordingURL ||
          ""
        ).trim(),
        To: (row.To || row.to || "").trim(),
      };

      // Check required fields
      const hasAll = Object.values(record).every((val) => val !== "");
      if (hasAll) {
        records.push(record);
        parsedCount++;
      } else {
        skippedCount++;
        console.warn(`⚠️ Skipping incomplete row: ${JSON.stringify(record)}`);
      }
    })
    .on("end", async () => {
      console.log(
        `📝 Parsed ${parsedCount} valid records, skipped ${skippedCount} incomplete`
      );
      if (parsedCount === 0) {
        console.error("❌ No valid records to insert.");
        mongoose.disconnect();
        return;
      }

      console.log("📥 Inserting into MongoDB...");
      try {
        await AiBotCalls.insertMany(records);
        console.log("✅ All records imported successfully.");
      } catch (err) {
        console.error("❌ Error inserting records:", err);
      } finally {
        mongoose.disconnect();
      }
    })
    .on("error", (err) => {
      console.error("❌ Error reading CSV file:", err);
      mongoose.disconnect();
    });
}

(async function main() {
  await connectDB();

  // Default CSV path in project root
  const csvPath = path.resolve(process.cwd(), "csv", "previous_call_data.csv");
  console.log(`Reading CSV from: ${csvPath}`);

  await importCSV(csvPath);
})();
