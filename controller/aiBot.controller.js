import AiBotCalls from "../model/aiBot.model.js";
import webhookQueue from "../queues/webhookQueues.js";

export const aibotcallswebhook = async (req, res) => {
  res.status(200).json({ message: "Webhook received" });

  webhookQueue
    .add(async () => {
      const {
        Date,
        Format,
        From,
        ProratedStorageCost,
        RecordingType,
        RecordingURL,
        To,
      } = req.body;

      const record = {
        Date,
        Format,
        From,
        ProratedStorageCost,
        RecordingType,
        RecordingURL,
        To,
      };

      try {
        await AiBotCalls.create(record);
        console.log("✅ Webhook data saved");
      } catch (error) {
        console.error("❌ Error saving webhook data:", error.message);
      }
    })
    .catch((err) => {
      // This catch is just in case the queue itself errors
      console.error("❌ Queue error:", err);
    });
};

export default aibotcallswebhook;
