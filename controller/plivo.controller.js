import { create } from "xmlbuilder2";
import fs from "fs";
import PlivoReport from "../model/plivo-job-report.model.js";

export const plivoAnswer = async (req, res) => {
  try {
    console.log("Plivo answer");
    const { reportId, cropName, label } = req.query;
    if (label == "Daily_RTH") {
      const responseXml = create({ version: "1.0" })
        .ele("Response")
        .ele("GetDigits", {
          action: `https://campdash.onrender.com/plivo/answer-handle?reportId=${reportId}&cropName=${cropName}`,
          method: "POST",
          timeout: "10",
          numDigits: "1",
        })
        // Play greeting audio from jsDelivr GitHub CDN
        .ele("Play")
        .txt(
          "https://cdn.jsdelivr.net/gh/shahnoor-oneRoot/plivo-audios@main/audio/greeting.wav"
        )
        .up()
        .up() // close GetDigits
        .ele("Speak")
        .txt("We did not receive any input. Goodbye!")
        .up()
        .end({ prettyPrint: true });

      return res.type("text/xml").send(responseXml);
    }

    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: `https://campdash.onrender.com/plivo/answer-handle?reportId=${reportId}&cropName=${cropName}`,
        method: "POST",
        timeout: "10",
        numDigits: "1",
      })
      .ele("Speak")
      .txt(
        "https://cdn.jsdelivr.net/gh/shahnoor-oneRoot/plivo-audios@main/audio/thanks.wav"
      )
      .up()
      .up() // close GetDigits
      .ele("Speak")
      .txt("We did not receive any input. Goodbye!")
      .end({ prettyPrint: true });

    res.type("text/xml").send(responseXml);
  } catch (error) {
    console.error("Plivo XML generation failed:", error);
    res.status(500).send("Internal server error");
  }
};

// Handle initial digit: 1 = usual, 2 = ask days
export const plivoAnswerHandle = async (req, res) => {
  try {
    console.log("Plivo answer-handle", req.body);
    const { reportId, cropName } = req.query;
    const { To, Digits } = req.body;

    if (!To || !Digits) {
      console.warn("Missing 'To' or 'Digits' in Plivo payload");
      return res.status(400).send("Missing required input");
    }

    if (Digits === "1") {
      const campaign = await PlivoReport.findById(reportId);
      if (campaign) {
        campaign.campaign_report.push({
          cropname: cropName,
          number: To,
          given_on: new Date(),
          ready: true,
        });
        await campaign.save();
        console.log(`Recorded usual update for ${To}`);
      }

      // Respond and hang up
      const xml = create({ version: "1.0" })
        .ele("Response")
        .ele("Speak")
        .txt("Thank you. Your usual update will be sent. Goodbye.")
        .up()
        .end({ prettyPrint: true });

      return res.type("text/xml").send(xml);
    }

    if (Digits === "2") {
      // Ask for days input (up to 2 digits)
      const xml = create({ version: "1.0" })
        .ele("Response")
        .ele("GetDigits", {
          action: `https://campdash.onrender.com/plivo/days-handle?reportId=${reportId}&cropName=${cropName}`,
          method: "POST",
          timeout: "10",
          numDigits: "2",
        })
        .ele("Speak")
        .txt(
          "How many days until your crop will be ready? Please enter two digits."
        )
        .up()
        .up()
        .ele("Speak")
        .txt("No input received. Goodbye!")
        .end({ prettyPrint: true });

      return res.type("text/xml").send(xml);
    }

    // Invalid input
    const invalidXml = create({ version: "1.0" })
      .ele("Response")
      .ele("Speak")
      .txt("Invalid input. Goodbye.")
      .up()
      .end({ prettyPrint: true });

    res.type("text/xml").send(invalidXml);
  } catch (error) {
    console.error("Error in plivoAnswerHandle:", error);
    res.status(500).send("Internal Server Error");
  }
};

export const plivoDaysHandle = async (req, res) => {
  try {
    console.log("Plivo days-handle", req.body);
    const { reportId, cropName } = req.query;
    const { To, Digits } = req.body;

    if (!To || !Digits) {
      console.warn("Missing 'To' or 'Digits' in Plivo payload");
      return res.status(400).send("Missing required input");
    }

    const days = parseInt(Digits, 10);
    // Directly push days entry
    await PlivoReport.findByIdAndUpdate(reportId, {
      $push: {
        campaign_report: {
          cropname: cropName,
          number: To,
          given_on: new Date(),
          ready: false,
          next_RTH_in_days: days,
        },
      },
    });
    console.log(`Recorded ${days} days for ${To}`);

    const xml = create({ version: "1.0" })
      .ele("Response")
      .ele("Speak")
      .txt(`You entered ${days} days. Thank you. Goodbye.`)
      .up()
      .end({ prettyPrint: true });

    res.type("text/xml").send(xml);
  } catch (error) {
    console.error("Error in plivoDaysHandle:", error);
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
