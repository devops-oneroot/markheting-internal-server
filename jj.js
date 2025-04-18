import mongoose from "mongoose";
import dotenv from "dotenv";
import PlivoReport from "./model/plivo-job-report.model.js";

dotenv.config();

function getISTDateRange() {
  const now = new Date();
  const istOffsetMinutes = 330;

  const istNow = new Date(now.getTime() + istOffsetMinutes * 60000);
  const istMidnight = new Date(istNow);
  istMidnight.setHours(0, 0, 0, 0);

  const utcToday = new Date(istMidnight.getTime() - istOffsetMinutes * 60000);
  const utcTomorrow = new Date(utcToday);
  utcTomorrow.setDate(utcTomorrow.getDate() + 1);

  return { istToday: utcToday, istTomorrow: utcTomorrow };
}

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

async function createAndFetchCampaign() {
  const { istToday, istTomorrow } = getISTDateRange();

  console.log("📅 IST Today:", istToday.toISOString());

  // Check if campaign exists
  let campaign = await PlivoReport.findOne({
    campaign_date: { $gte: istToday, $lt: istTomorrow },
  });

  if (!campaign) {
    // Create it
    campaign = await PlivoReport.create({ campaign_date: istToday });
    console.log("✅ Created new campaign for today");
  } else {
    console.log("📄 Campaign already exists for today");
  }

  console.log("📤 Campaign Document:", JSON.stringify(campaign, null, 2));
}

connectMongo()
  .then(createAndFetchCampaign)
  .finally(() => {
    mongoose.disconnect();
  });
