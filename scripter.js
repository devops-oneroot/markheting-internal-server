import mongoose from "mongoose";
import User from "./model/user.model.js";

const MONGO_URI =
  "mongodb+srv://haidernadaf67:haider9900@cluster0.zokanwm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function bulkFixConsentDates(batchSize = 1000) {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const collection = mongoose.connection.collection("users");

  let totalFixed = 0;
  let hasMore = true;

  while (hasMore) {
    const docs = await collection
      .find({ consent_date: { $type: "string" } })
      .limit(batchSize)
      .toArray();

    if (docs.length === 0) {
      hasMore = false;
      break;
    }

    const operations = [];

    for (const doc of docs) {
      const raw = doc.consent_date;

      if (ISO_REGEX.test(raw)) {
        // Already looks like a valid ISO string, skip
        continue;
      }

      const parsedDate = new Date(raw);

      if (!isNaN(parsedDate)) {
        operations.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { consent_date: parsedDate } },
          },
        });
        totalFixed++;
      } else {
        console.warn(`⚠️ Skipping invalid date for _id=${doc._id}`);
      }
    }

    if (operations.length > 0) {
      await collection.bulkWrite(operations);
      console.log(`✅ Batch updated: ${operations.length}`);
    } else {
      console.log("🔁 No valid updates in this batch.");
    }
  }

  await mongoose.disconnect();
  console.log(`🎉 Done. Total fixed: ${totalFixed}`);
}

bulkFixConsentDates().catch(console.error);
