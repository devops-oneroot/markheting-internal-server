import Ticket from "../model/ticket.model.js";
import Agent from "../model/agent.model.js";
import mongoose from "mongoose";

export const adminGetAllAgents = async (req, res) => {
  if (req.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const agents = await Agent.find();
    if (!agents || agents.length === 0) {
      return res.status(404).json({ message: "No agents found." });
    }
    return res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getTicketsByAgentId = async (req, res) => {
  if (req.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid agent ID" });
    }

    const agentObjectId = new mongoose.Types.ObjectId(id);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const matchStage = {
      assigned_to: agentObjectId,
      status: { $in: ["Opened", "Waiting For"] },
    };

    const tickets = await Ticket.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          priorityRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "asap"] }, then: 1 },
                { case: { $eq: ["$priority", "high"] }, then: 2 },
                { case: { $eq: ["$priority", "medium"] }, then: 3 },
                { case: { $eq: ["$priority", "low"] }, then: 4 },
              ],
              default: 5,
            },
          },
        },
      },
      {
        $addFields: {
          groupRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "asap"] }, then: 1 },
                { case: { $lt: ["$dueDate", startOfDay] }, then: 2 },
                {
                  case: {
                    $and: [
                      { $gte: ["$dueDate", startOfDay] },
                      { $lte: ["$dueDate", endOfDay] },
                    ],
                  },
                  then: 3,
                },
                { case: { $eq: ["$status", "Waiting For"] }, then: 5 },
              ],
              default: 4,
            },
          },
        },
      },
      { $sort: { groupRank: 1, priorityRank: 1, dueDate: 1 } },
    ]);

    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    console.error("getTicketsByAgentId error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
