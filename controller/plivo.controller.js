import { create } from "xmlbuilder2";
import fs from "fs";
import PlivoReport from "../model/plivo-job-report.model.js";

const cropAudioMap = {
  rth_on_audio: encodeURI(
    "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/Farmer Confirms Ready.wav"
  ),
  rth_off_audio: encodeURI(
    "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/Press 3.wav"
  ),
  rth_days_audio: encodeURI(
    "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/Press 2.wav"
  ),
  rth_days_ending_audio: encodeURI(
    "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/thanks.wav"
  ),
  tender_coconut: {
    greeting: encodeURI(
      "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/TC-RTH-Hero.wav"
    ),
  },
  maize: {
    greeting: encodeURI(
      "https://raw.githubusercontent.com/shahnoor-oneRoot/plivo-audios/main/audio/Maize-RTH-Hero.wav"
    ),
  },
};

function getCropAudios(cropName) {
  return cropAudioMap[cropName] || cropAudioMap["tender_coconut"];
}

export const plivoAnswer = async (req, res) => {
  try {
    const { reportId, cropName, label } = req.query;
    const { To } = req.body;

    const report = await PlivoReport.findById(reportId);
    if (report) {
      if (!report.number_pickups.includes(To)) {
        report.number_pickups.push(To);
        report.no_of_pickups = report.number_pickups.length;
        await report.save();
      }
    }

    const cropAudios = getCropAudios(cropName);

    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: `${process.env.SELFURL}/plivo/answer-handle?reportId=${reportId}&cropName=${cropName}`,
        method: "POST",
        timeout: "10",
        numDigits: "1",
      })
      .ele("Play")
      .txt(cropAudios.greeting) // crop greeting
      .up()
      .up()
      .ele("Speak")
      .txt("We did not receive any input. Goodbye!")
      .up()
      .end({ prettyPrint: true });

    res.type("text/xml").send(responseXml);
  } catch (error) {
    console.error("Plivo XML generation failed:", error);
    res.status(500).send("Internal server error");
  }
};

// Handle digits: 1 = ready today, 2 = ask days, 3 = not ready/off
export const plivoAnswerHandle = async (req, res) => {
  try {
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
      }

      const xml = create({ version: "1.0" })
        .ele("Response")
        .ele("Play")
        .txt(cropAudioMap.rth_on_audio) // Press 1 audio
        .up()
        .end({ prettyPrint: true });

      return res.type("text/xml").send(xml);
    }

    if (Digits === "2") {
      const xml = create({ version: "1.0" })
        .ele("Response")
        .ele("GetDigits", {
          action: `${process.env.SELFURL}/plivo/days-handle?reportId=${reportId}&cropName=${cropName}`,
          method: "POST",
          timeout: "10",
          numDigits: "2",
        })
        .ele("Play")
        .txt(cropAudioMap.rth_days_audio) // Press 2 audio
        .up()
        .up()
        .ele("Speak")
        .txt("No input received. Goodbye!")
        .end({ prettyPrint: true });

      return res.type("text/xml").send(xml);
    }

    if (Digits == "3") {
      const campaign = await PlivoReport.findById(reportId);
      if (campaign) {
        campaign.campaign_report.push({
          cropname: cropName,
          number: To,
          given_on: new Date(),
          ready: false,
          cropNotAvailable: true,
        });
        await campaign.save();
        console.log(`Recorded RTH OFF for ${To}`);
      }

      const xml = create({ version: "1.0" })
        .ele("Response")
        .ele("Play")
        .txt(cropAudioMap.rth_off_audio) // Press 3 audio
        .up()
        .end({ prettyPrint: true });

      return res.type("text/xml").send(xml);
    }

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
    const { reportId, cropName } = req.query;
    const { To, Digits } = req.body;

    if (!To || !Digits) {
      console.warn("Missing 'To' or 'Digits' in Plivo payload");
      return res.status(400).send("Missing required input");
    }

    const days = parseInt(Digits, 10);

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
      .ele("Play")
      .txt(cropAudioMap.rth_days_ending_audio) // Thanks
      .up()
      .end({ prettyPrint: true });

    res.type("text/xml").send(xml);
  } catch (error) {
    console.error("Error in plivoDaysHandle:", error);
    res.status(500).send("Internal Server Error");
  }
};

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
