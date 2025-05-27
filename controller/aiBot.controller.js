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

export const BotCallAddedStatus = async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) {
      return res.status(400).json({ message: "Call ID is required" });
    }
    const call = await AiBotCalls.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }
    call.has_added = call.has_added ? false : true;
    await call.save();
    return res.status(200).json({ message: "Call status updated", call });
  } catch (error) {
    console.error("Error updating call status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sortByTrees = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 50);
    const skip = (page - 1) * limit;

    const sort = { no_of_trees: -1 };

    const total = await AiBotCalls.countDocuments();

    const data = await AiBotCalls.find({})
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
    console.error("Error sorting AI bot calls by trees:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllNumbers = async (req, res) => {
  try {
    const numbers = await AiBotCalls.distinct("To");
    return res.status(200).json({ numbers });
  } catch (error) {
    console.error("Error fetching all numbers:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default aibotcallswebhook;
