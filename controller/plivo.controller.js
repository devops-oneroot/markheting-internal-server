import { create } from "xmlbuilder2";
import fs from "fs";
import PlivoReport from "../model/plivo-job-report.model.js";

export const plivoAnswer = async (req, res) => {
  try {
    console.log("Plivo answer");
    const reportId = req.query.reportId;
    const cropName = req.query.cropName;

    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: `https://campdash.onrender.com/plivo/answer-handle?reportId=${reportId}&cropName=${cropName}`,
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
  const reportId = req.query.reportId?.split("?")[0];
  console.log(reportId, "report id");
  const cropName = req.query.cropName;
  console.log();
  try {
    const { To, Digits } = req.body;

    if (!To || !Digits) {
      console.warn("❌ Missing 'From' or 'Digits' in Plivo response");
      return res.status(400).send("Missing required input");
    }

    const ready = Digits === "1";

    // 3) Find today’s campaign
    const campaign = await PlivoReport.findById(reportId);

    console.log(campaign, "campaig");

    if (campaign) {
      campaign.campaign_report.push({
        cropname: cropName,
        number: To,
        given_on: new Date(),
        ready,
      });

      await campaign.save();
      console.log(`✅ Recorded response for ${To}, ready: ${ready}`);
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
