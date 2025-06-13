import mongoose from "mongoose";
import Ticket from "../model/ticket.model.js";
import User from "../model/user.model.js"; 

export const createTicket = async (req, res) => {
  try {
    // Create the ticket
    const {
      _id,
      task,
      assigned_to,
      priority,
      cropName,
      dueDate,
      status,
      id,
      name,
      number,
      taluk,
      district,
      pincode,
      tag,
      downloaded,
      consent,
      consent_date,
      village,
      age,
      farmer_category,
    } = req.body;

    const ticket = await Ticket.create({
      _id,
      task,
      assigned_to,
      priority,
      cropName,
      dueDate,
      status: status || "Opened",
      created_By: id,
      name,
      number,
      taluk,
      district,
      pincode,
      tag,
      downloaded,
      consent,
      consent_date: consent_date, // Map to the schema field
      village,
      age,
      farmer_category: farmer_category, // Map to the schema field
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfullyyyy.",
      data: ticket,
    });
  } catch (error) {
    console.error("createTicket error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

export const getTicketsOpenedById = async (req, res) => {
  try {
    const id = req.user;
    const agentObjectId = new mongoose.Types.ObjectId(id);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const tickets = await Ticket.aggregate([
      {
        $match: {
          assigned_to: agentObjectId,
          status: { $in: ["Opened", "Waiting For"] },
        },
      },
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
    console.error("getTicketsOpenedById error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateTicketById = async (req, res) => {
  const { id, status, remarks, priority, task, assigned_to } = req.body;
  const agentId = req.user?.id;

  if (!id) {
    return res.status(400).json({ message: "No ticket ID provided." });
  }

  try {
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const isAssigned = ticket.assigned_to.some(
      (assignedAgentId) => assignedAgentId.toString() === agentId
    );

    if (!isAssigned) {
      return res.status(403).json({
        message: "Access denied. You are not assigned to this ticket.",
      });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assigned_to) ticket.assigned_to = assigned_to;
    if (task) ticket.task = task;
    if (remarks) {
      ticket.remarks.push({
        remark: remarks,
        by: agentId,
        time: new Date(),
      });
    }

    await ticket.save();

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("updateTicketById error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getUserAssignedTicketsById = async (req, res) => {
  try {
    const { userId } = req.params;
    const agentObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const tickets = await Ticket.aggregate([
      {
        $match: {
          userId: agentObjectId,
          status: { $in: ["Opened", "Waiting For", "Closed"] },
        },
      },
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
                { case: { $eq: ["$status", "Closed"] }, then: 6 },
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
    console.error("getTicketsOpenedById error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const deleteTickets = async (req, res) => {
  try {
    const agentId = req?.body.id;
    const { deleteIds } = req.body;
    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No ticket IDs provided." });
    }

    const result = await Ticket.deleteMany({
      _id: { $in: deleteIds },
      assigned_to: { $elemMatch: { $eq: agentId } },
    });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} ticket(s) deleted successfully.`,
    });
  } catch (error) {
    console.error("deleteTickets error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};




// Controller function to fetch user data
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Return user data
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};