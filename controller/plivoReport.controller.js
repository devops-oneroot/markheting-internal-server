import PlivoReport from "../model/plivo-job-report.model.js";

export const getDailyRTHReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ message: "Missing required `date` query parameter" });
    }

    const start = new Date(date);
    if (isNaN(start)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD or ISO string.",
      });
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const report = await PlivoReport.findOne({
      label: "Daily_RTH",
      createdAt: {
        $gte: start,
        $lt: end,
      },
    });

    return res.json(report || {});
  } catch (error) {
    console.error("Error fetching report:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getPreRTHReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ message: "Missing required `date` query parameter" });
    }

    const start = new Date(date);
    if (isNaN(start)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD or ISO string.",
      });
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const report = await PlivoReport.findOne({
      label: "Pre_RTH",
      createdAt: {
        $gte: start,
        $lt: end,
      },
    });

    return res.json(report || {});
  } catch (error) {
    console.error("Error fetching report:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
