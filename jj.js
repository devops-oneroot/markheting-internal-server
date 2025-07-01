// dedupe-users.js
import mongoose from "mongoose";
import User from "./model/user.model.js"; // adjust path if needed

const MONGO_URI =
  "mongodb+srv://shahnoor-dev:7204408035pass@dummydash.k215o.mongodb.net/?retryWrites=true&w=majority&appName=dummyDash";

async function normalize(number) {
  return number.replace(/^\+91/, "").trim();
}

async function mergeAndDelete(dup, base) {
  // Decide primary vs secondary
  let primary = base;
  let secondary = dup;

  const dupConsentYes = dup.consent === "yes";
  const baseConsentYes = base.consent === "yes";

  if (dupConsentYes && !baseConsentYes) {
    primary = dup;
    secondary = base;
  } else if (dupConsentYes && baseConsentYes) {
    // both have consent; keep the one with older date
    if (dup.consent_date < base.consent_date) {
      primary = dup;
      secondary = base;
    }
  }

  // List of fields to merge if missing on primary
  const fieldsToMerge = [
    "name",
    "gov_farmer_id",
    "age",
    "hobli",
    "farmer_category",
    "village",
    "taluk",
    "district",
    // number: we want primary.number to remain the normalized one
    // identity, tag, downloaded, downloaded_date, onboarded_date, pincode, coordinates
    "identity",
    "tag",
    "downloaded",
    "downloaded_date",
    "onboarded_date",
    "pincode",
    "coordinates",
  ];

  for (const field of fieldsToMerge) {
    if (
      (primary[field] === null ||
        primary[field] === undefined ||
        primary[field] === "") &&
      secondary[field] !== null &&
      secondary[field] !== undefined &&
      secondary[field] !== ""
    ) {
      primary[field] = secondary[field];
    }
  }

  // Merge notes arrays
  if (Array.isArray(secondary.notes) && secondary.notes.length) {
    primary.notes = [...(primary.notes || []), ...secondary.notes];
  }

  // Ensure consent/date on primary is the older/more important one
  if (dupConsentYes && baseConsentYes) {
    // we already picked primary as the older consent_date holder
    primary.consent = "yes";
    primary.consent_date = primary.consent_date; // already correct
  } else if (dupConsentYes || baseConsentYes) {
    // one of them had consent yes; primary has that
    primary.consent = "yes";
    primary.consent_date = primary.consent_date || secondary.consent_date;
  }

  // Normalize the primary number to no +91
  primary.number = await normalize(primary.number);

  await primary.save();
  await User.deleteOne({ _id: secondary._id });

  console.log(
    `⇒ Kept ${primary._id} (number=${primary.number}), removed ${secondary._id}`
  );
}

async function runDedupe() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("🗄️  Connected to MongoDB");

  const duplicates = await User.find({ number: { $regex: /^\+91/ } });
  console.log(`🔍 Found ${duplicates.length} users with +91 prefix`);

  for (const dup of duplicates) {
    const baseNumber = await normalize(dup.number);
    const base = await User.findOne({ number: baseNumber });
    if (!base) {
      // No base user—just normalize this one’s number instead of deleting
      dup.number = baseNumber;
      await dup.save();
      console.log(`✏️  Normalized standalone user ${dup._id} → ${baseNumber}`);
      continue;
    }

    // Merge and delete
    await mergeAndDelete(dup, base);
  }

  console.log("✅  Deduplication complete");
  await mongoose.disconnect();
}

runDedupe().catch((err) => {
  console.error("💥  Fatal error:", err);
  process.exit(1);
});
