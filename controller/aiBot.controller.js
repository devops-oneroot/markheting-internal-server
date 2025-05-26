import AiBotCalls from "../model/aiBot.model.js";
import webhookQueue from "../queues/webhookQueues.js";

export const aibotcallswebhook = async (req, res) => {
  res.status(200).json({ message: "Webhook received" });

  webhookQueue
    .add(async () => {
      const { Date, From, RecordingURL, To, no_of_trees } = req.body;

      const record = {
        Date,
        From,
        no_of_trees,
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

export const getAIcalls = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 50);
    const skip = (page - 1) * limit;

    const sortField = req.query.sortBy || "Date";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    const allowedFilters = ["Date", "Format", "From", "To", "RecordingType"];
    const filters = {};
    for (const key of allowedFilters) {
      if (req.query[key]) {
        filters[key] = req.query[key];
      }
    }

    const total = await AiBotCalls.countDocuments(filters);

    const data = await AiBotCalls.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      data,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    console.error("Error fetching AI bot calls:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default aibotcallswebhook;
