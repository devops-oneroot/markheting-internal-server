import { create } from "xmlbuilder2";
import fs from "fs";

// Returns XML to play custom audio and capture DTMF input
export const plivoAnswer = async (req, res) => {
  try {
    console.log("Plivo answer");
    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: "https://campdash.onrender.com/plivo/answer-handle",
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
  // 1) DEBUG: dump the whole body and its keys
  console.log("📥 plivoAnswerHandle raw body:", req.body);
  console.log("📥 plivoAnswerHandle body keys:", Object.keys(req.body));

  // 2) Your existing logic
  const { From, Digits } = req.body;
  const ready = Digits === "1";

  // compute IST midnight/tomorrow…
  const now = new Date();
  const istOffset = 5.5 * 60;
  const istNowMs = now.getTime() + istOffset * 60 * 1000;
  const istToday = new Date(istNowMs);
  istToday.setHours(0, 0, 0, 0);
  const istTomorrow = new Date(istToday);
  istTomorrow.setDate(istTomorrow.getDate() + 1);

  const campaign = await PlivoReport.findOne({
    campaign_date: { $gte: istToday, $lt: istTomorrow },
  });

  if (campaign) {
    campaign.campaign_report.push({
      cropname: "",
      number: From,
      given_on: new Date(),
      ready,
    });
    await campaign.save();
  } else {
    console.warn("⚠️ No campaign found for today to record DTMF");
  }

  // 3) Respond
  const responseXml = create({ version: "1.0" })
    .ele("Response")
    .ele("Speak")
    .txt("Thank you for your response. Goodbye!")
    .end({ prettyPrint: true });

  res.type("text/xml").send(responseXml);
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
