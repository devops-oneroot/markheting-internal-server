import IVR from "../model/ivr.model.js";
import User from "../model/user.model.js";
import { createUserAndSendFlow } from "../whatsapp.js";

const ivrFlowId = "1750143051951";

export const ivrWebhook = async (req, res) => {
  try {
    const {
      CallFrom: rawNumber,
      digits: rawDigits,
      CurrentTime,
      ivrName,
    } = req.query;

    // 1) Validate required param
    if (!rawNumber) {
      return res.status(400).send("Missing CallFrom");
    }

    const number = rawNumber.trim().replace(/^(\+91|0+)/, "");

    // 2) Normalize pressed digits: strip any surrounding quotes
    const pressed =
      rawDigits != null ? rawDigits.replace(/^"+|"+$/g, "").trim() : null;

    // 3) Check if user exists
    let tag;
    let user = await User.findOne({ number });
    if (!user) {
      // 3a) Create new user
      const now = new Date();
      user = await User.create({
        number,
        identity: "Farmer",
        consent: "yes",
        consent_date: now,
        tag: ivrName,
      });
      tag = "new user";
    } else {
      if (user.downloaded) {
        tag = "App user";
      } else if (user.downloaded == false) {
        tag = "Onboard user";
      } else {
        if (user.consent !== "yes") {
          user.consent = "yes";
          user.consent_date = new Date();
          await user.save();
        }
        tag = "Lead User";
      }
    }

    // 4) Record IVR entry
    const ivrEntry = await IVR.create({
      name: ivrName,
      number,
      pressed,
      tag,
      called_date: CurrentTime,
    });

    console.log("IVR entry created:", ivrEntry);
    console.log("number:", number);
    console.log("ivrFlowId:", ivrFlowId);
    const message = await createUserAndSendFlow({
      phone: number,
      flowId: ivrFlowId,
      type: "IVR",
    });
    console.log("IVR message sent:", message);

    return res.json({
      message: "IVR data saved successfully",
      data: ivrEntry,
      message,
    });
  } catch (err) {
    console.error("Error in ivrWebhook:", err);
    return res.status(500).send("Internal Server Error");
  }
};

export const ivrRecords = async (req, res) => {
  try {
    const data = await IVR.find({});
    if (!data) {
      return res.status(404).send("No data found");
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in ivrUser:", error);
    return res.status(500).send("Internal Server Error");
  }
};
