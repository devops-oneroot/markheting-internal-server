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
    const {
      page = 1,
      date,
      from,
      to,
      recordingType,
      search,
      hasAdded,
      minTrees,
      maxTrees,
      dateRange,
      sortBy = "Date",
      order = "desc",
    } = req.query;

    const limit = 50;
    const skip = (page - 1) * limit;
    const sortOrder = order === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const query = buildAICallsQuery({
      date,
      from,
      to,
      recordingType,
      search,
      hasAdded,
      minTrees,
      maxTrees,
      dateRange,
    });

    // Execute both queries in parallel
    const [calls, totalCalls] = await Promise.all([
      AiBotCalls.find(query).sort(sort).skip(skip).limit(limit).lean(),
      AiBotCalls.countDocuments(query),
    ]);

    res.json({
      calls,
      totalPages: Math.ceil(totalCalls / limit),
      totalCalls,
      currentPage: parseInt(page),
      hasNextPage: page < Math.ceil(totalCalls / limit),
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Error fetching AI bot calls:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
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

//helper function to build the query
const buildAICallsQuery = ({
  date,
  from,
  to,
  recordingType,
  search,
  hasAdded,
  minTrees,
  maxTrees,
  dateRange,
}) => {
  const query = {};

  if (date) {
    query.Date = date;
  } else if (dateRange) {
    const [startDate, endDate] = dateRange.split(",");
    if (startDate && endDate) {
      query.Date = { $gte: startDate, $lte: endDate };
    }
  }

  if (from) {
    query.From = new RegExp(from, "i");
  }

  if (to) {
    query.To = new RegExp(to, "i"); // Case-insensitive partial match
  }

  // Recording type filtering (if you have this field)
  if (recordingType) {
    query.RecordingType = recordingType;
  }

  // Search across multiple fields
  if (search) {
    query.$or = [
      { From: new RegExp(search, "i") },
      { To: new RegExp(search, "i") },
      { Date: new RegExp(search, "i") },
    ];
  }

  // Boolean filtering for has_added
  if (hasAdded !== undefined) {
    query.has_added = hasAdded === "true";
  }

  // Tree count filtering
  if (minTrees !== undefined) {
    query.no_of_trees = { ...query.no_of_trees, $gte: parseInt(minTrees) };
  }

  if (maxTrees !== undefined) {
    query.no_of_trees = { ...query.no_of_trees, $lte: parseInt(maxTrees) };
  }

  return query;
};

export default aibotcallswebhook;
