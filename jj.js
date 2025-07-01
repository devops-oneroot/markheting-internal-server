// dedupe-users.js
import mongoose from "mongoose";
import User from "./model/user.model.js";

const MONGO_URI =
  "mongodb+srv://shahnoor-dev:7204408035pass@dummydash.k215o.mongodb.net/?retryWrites=true&w=majority&appName=dummyDash";

// normalize strips any leading '+91' or '91'
function normalize(number) {
  const n = String(number).trim();
  if (n.startsWith("+91")) return n.slice(3).trim();
  if (n.startsWith("91")) return n.slice(2).trim();
  return n;
}

async function mergeAndDelete(dup, primary) {
  // Determine which record to keep
  let keep = primary;
  let remove = dup;

  const dupConsent = dup.consent === "yes";
  const primConsent = primary.consent === "yes";

  if (dupConsent && !primConsent) {
    keep = dup;
    remove = primary;
  } else if (dupConsent && primConsent) {
    // both consent: keep the older consent_date
    if ((dup.consent_date || 0) < (primary.consent_date || 0)) {
      keep = dup;
      remove = primary;
    }
  }

  // Merge missing fields
  const fields = [
    "name",
    "gov_farmer_id",
    "age",
    "hobli",
    "farmer_category",
    "village",
    "taluk",
    "district",
    "identity",
    "tag",
    "downloaded",
    "downloaded_date",
    "onboarded_date",
    "pincode",
    "coordinates",
  ];
  fields.forEach((f) => {
    if (
      (keep[f] === undefined || keep[f] === null || keep[f] === "") &&
      remove[f] !== undefined &&
      remove[f] !== null &&
      remove[f] !== ""
    ) {
      keep[f] = remove[f];
    }
  });

  // Combine notes arrays
  if (Array.isArray(remove.notes) && remove.notes.length) {
    keep.notes = [...(keep.notes || []), ...remove.notes];
  }

  // Ensure consent/date fields are correct
  if (dupConsent || primConsent) {
    keep.consent = "yes";
    keep.consent_date = keep.consent_date || remove.consent_date;
  }

  // Normalize number on kept record
  keep.number = normalize(keep.number);

  // Delete the old doc first to avoid duplicate-key on save
  await User.deleteOne({ _id: remove._id });
  try {
    await keep.save();
    console.log(
      `⇒ Kept ${keep._id} (num=${keep.number}), removed ${remove._id}`
    );
  } catch (err) {
    console.error("❌ Error saving merged user:", err);
  }
}

async function runDedupe() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("🗄️  Connected to MongoDB");

  // Find all users whose number starts with +91
  const duplicates = await User.find({ number: /^\+91/ });
  console.log(`🔍 Found ${duplicates.length} '+91' users`);

  for (const dup of duplicates) {
    const normNum = normalize(dup.number);

    // Look for an existing user without prefix
    const primary = await User.findOne({ number: normNum });
    if (primary) {
      // Merge data and delete duplicate
      await mergeAndDelete(dup, primary);
    } else {
      // No existing base—rename this one
      dup.number = normNum;
      try {
        await dup.save();
        console.log(`✏️  Renamed standalone ${dup._id} → ${normNum}`);
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate-key: someone else got created—delete this then merge
          await User.deleteOne({ _id: dup._id });
          const exist = await User.findOne({ number: normNum });
          if (exist) {
            console.log(
              `⚠️ Race detected, merging ${dup._id} into existing ${exist._id}`
            );
            await mergeAndDelete(dup, exist);
          }
        } else {
          console.error("❌ Error saving normalized user:", err);
        }
      }
    }
  }

  console.log("✅  Deduplication complete");
  await mongoose.disconnect();
}

runDedupe().catch((err) => {
  console.error("💥  Fatal error:", err);
  process.exit(1);
});
