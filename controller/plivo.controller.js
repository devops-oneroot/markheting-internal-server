import { create } from "xmlbuilder2";
import fs from "fs";
import PlivoReport from "../model/plivo-job-report.model.js";
import { getISTDateRange } from "../utils/plivo/index.js";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

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

export const plivoAnswer = async (req, res) => {
  try {
    console.log("Plivo answer");
    const reportId = req.query.reportId;

    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: `https://campdash.onrender.com/plivo/answer-handle?reportId=${reportId}`,
        method: "POST",
        timeout: "10",
        numDigits: "1",
      })
      .ele("Play")
      .txt(
        "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3"
      )
      .up()
      .up()
      .ele("Speak")
      .txt("We did not receive any input. Goodbye!")
      .end({ prettyPrint: true });

    res.set("Content-Type", "text/xml");
    res.send(responseXml);
  } catch (error) {
    console.error("Plivo XML generation failed:", error);
    res.status(500).send("Internal server error");
  }
};

// Handles DTMF input from the user and logs the result
export const plivoAnswerHandle = async (req, res) => {
  const reportId = req.query.reportId;
  console.log(reportId, "here");
  try {
    // 1) Log incoming request body for debugging
    console.log("📥 plivoAnswerHandle raw body:", req.body);
    console.log("📥 plivoAnswerHandle keys:", Object.keys(req.body));

    const { From, Digits } = req.body;

    if (!From || !Digits) {
      console.warn("❌ Missing 'From' or 'Digits' in Plivo response");
      return res.status(400).send("Missing required input");
    }

    const ready = Digits === "1";

    // 2) Get IST time range
    const { istToday, istTomorrow } = getISTDateRange();

    console.log(
      "📆 Looking for campaign between:",
      istToday.toISOString(),
      "and",
      istTomorrow.toISOString()
    );

    await connectMongo();

    // 3) Find today’s campaign
    const campaign = await PlivoReport.findById(reportId);

    console.log(campaign, "campaig");

    if (campaign) {
      campaign.campaign_report.push({
        cropname: "", // Optional: add logic to fetch correct cropname
        number: From,
        given_on: new Date(),
        ready,
      });

      await campaign.save();
      console.log(`✅ Recorded response for ${From}, ready: ${ready}`);
    } else {
      console.warn("⚠️ No campaign found for today to record DTMF");
    }

    // 4) Respond to caller with XML
    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("Speak")
      .txt("Thank you for your response. Goodbye!")
      .end({ prettyPrint: true });

    res.type("text/xml").send(responseXml);
  } catch (error) {
    console.error("💥 Error in plivoAnswerHandle:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Handles hangup events and logs them
export const plivoHangup = async (req, res) => {
  console.log("Plivo hang");
  const { CallUUID, From, To, EndTime, HangupCause } = req.body;

  const hangupData = {
    call_uuid: CallUUID,
    from_number: From,
    to_number: To,
    end_time: EndTime || new Date().toISOString(),
    hangup_cause: HangupCause || "Unknown",
    event: "hangup",
  };

  fs.appendFile(
    "campaign_results.json",
    JSON.stringify(hangupData) + ",\n",
    (err) => {
      if (err) console.error("Error logging hangup data:", err);
    }
  );

  res.status(200).send("Hangup event received");
};

export const getTodayCampaign = async (req, res) => {
  try {
    const { istToday, istTomorrow } = getISTDateRange();

    const todayCampaign = await PlivoReport.findOne({
      campaign_date: {
        $gte: istToday,
        $lt: istTomorrow,
      },
    });

    if (!todayCampaign) {
      return res.status(404).json({ message: "No campaign found for today" });
    }

    res.json(todayCampaign);
  } catch (err) {
    console.error("💥 Error getting today's campaign:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
