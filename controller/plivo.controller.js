import { create } from "xmlbuilder2";
import fs from "fs";

// Returns XML to play custom audio and capture DTMF input
export const plivoAnswer = async (req, res) => {
  try {
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
  const { CallUUID, From, To, Digits } = req.body;

  const result = {
    call_uuid: CallUUID,
    from_number: From,
    to_number: To,
    dtmf_digit: Digits || null,
    status: "completed",
    timestamp: new Date().toISOString(),
  };

  fs.appendFile(
    "campaign_results.json",
    JSON.stringify(result) + ",\n",
    (err) => {
      if (err) console.error("Error writing result:", err);
    }
  );

  res.set("Content-Type", "text/xml");
  res.send(
    `<Response><Speak>Thank you for your response. Goodbye!</Speak></Response>`
  );
};

// Handles hangup events and logs them
export const plivoHangup = async (req, res) => {
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
