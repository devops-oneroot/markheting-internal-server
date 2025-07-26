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

export const getTicketById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "No ticket ID provided." });
  }
  try {
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const agentId = req.user?.id;
    const role = req.role;

    if (role === "agent") {
      const isAssigned = ticket.assigned_to.some(
        (assignedAgentId) => assignedAgentId.toString() === agentId
      );

      if (!isAssigned) {
        return res.status(403).json({
          message: "Access denied. You are not assigned to this ticket.",
        });
      }
    }

    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error("getTicketById error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// export const getTicketsOpened = async (req, res) => {
//   try {
//     const id = req.user;
//     const role = req.role;
//     const agentObjectId = new mongoose.Types.ObjectId(id);
//     const now = new Date();
//     const startOfDay = new Date(now.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(now.setHours(23, 59, 59, 999));

//     // Get pagination parameters from query (with defaults)
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     console.log("role:", role);

//     let matchStage;
//     if (role === "admin") {
//       matchStage = {
//         status: { $in: ["Opened", "Waiting For"] },
//       };
//     } else {
//       matchStage = {
//         assigned_to: agentObjectId,
//         status: { $in: ["Opened", "Waiting For"] },
//       };
//     }

//     // Create aggregation pipeline with pagination
//     const aggregationPipeline = [
//       { $match: matchStage },
//       {
//         $addFields: {
//           priorityRank: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$priority", "asap"] }, then: 1 },
//                 { case: { $eq: ["$priority", "high"] }, then: 2 },
//                 { case: { $eq: ["$priority", "medium"] }, then: 3 },
//                 { case: { $eq: ["$priority", "low"] }, then: 4 },
//               ],
//               default: 5,
//             },
//           },
//         },
//       },
//       {
//         $addFields: {
//           groupRank: {
//             $switch: {
//               branches: [
//                 { case: { $eq: ["$priority", "asap"] }, then: 1 },
//                 { case: { $lt: ["$dueDate", startOfDay] }, then: 2 },
//                 {
//                   case: {
//                     $and: [
//                       { $gte: ["$dueDate", startOfDay] },
//                       { $lte: ["$dueDate", endOfDay] },
//                     ],
//                   },
//                   then: 3,
//                 },
//                 { case: { $eq: ["$status", "Waiting For"] }, then: 5 },
//               ],
//               default: 4,
//             },
//           },
//         },
//       },
//       { $sort: { groupRank: 1, priorityRank: 1, dueDate: 1 } },
//       {
//         $facet: {
//           metadata: [
//             { $count: "total" },
//             {
//               $addFields: {
//                 page,
//                 limit,
//                 totalPages: { $ceil: { $divide: ["$total", limit] } },
//               },
//             },
//           ],
//           data: [{ $skip: skip }, { $limit: limit }],
//         },
//       },
//     ];

//     const [result] = await Ticket.aggregate(aggregationPipeline);

//     // Extract pagination metadata
//     const metadata = result.metadata[0] || {
//       total: 0,
//       page,
//       limit,
//       totalPages: 0,
//     };
//     const tickets = result.data;

//     return res.status(200).json({
//       success: true,
//       data: tickets,
//       pagination: {
//         currentPage: metadata.page,
//         totalPages: metadata.totalPages,
//         totalItems: metadata.total,
//         limit: metadata.limit,
//       },
//     });
//   } catch (error) {
//     console.error("getTicketsOpened error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

export const getTicketsOpened = async (req, res) => {
  try {
    const id = req.user;
    const role = req.role;
    const agentObjectId = new mongoose.Types.ObjectId(id);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let matchStage;
    if (role === "admin") {
      matchStage = { status: { $in: ["Opened", "Waiting For"] } };
    } else {
      matchStage = {
        assigned_to: agentObjectId,
        status: { $in: ["Opened", "Waiting For"] },
      };
    }

    const aggregationPipeline = [
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
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { groupRank: 1, priorityRank: 1, dueDate: 1 } },
      {
        $facet: {
          metadata: [
            { $count: "total" },
            {
              $addFields: {
                page,
                limit,
                totalPages: { $ceil: { $divide: ["$total", limit] } },
              },
            },
          ],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const [result] = await Ticket.aggregate(aggregationPipeline);

    const metadata = result.metadata[0] || {
      total: 0,
      page,
      limit,
      totalPages: 0,
    };

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        currentPage: metadata.page,
        totalPages: metadata.totalPages,
        totalItems: metadata.total,
        limit: metadata.limit,
      },
    });
  } catch (error) {
    console.error("getTicketsOpened error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateTicketById = async (req, res) => {
  const { id, status, remarks, priority, task, assigned_to } = req.body;
  const agentId = req.user?.id;
  const role = req.role;

  if (!id) {
    return res.status(400).json({ message: "No ticket ID provided." });
  }

  try {
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    if (role === "agent") {
      const isAssigned = ticket.assigned_to.some(
        (assignedAgentId) => assignedAgentId.toString() === agentId
      );

      if (!isAssigned) {
        return res.status(403).json({
          message: "Access denied. You are not assigned to this ticket.",
        });
      }
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

export const multiTicketUpdate = async (req, res) => {
  try {
    const { ticketIds, status, priority, assigned_to } = req.body;
    const agentId = req.user?.id;
    const role = req.role;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ message: "No ticket IDs provided." });
    }

    const tickets = await Ticket.find({
      _id: { $in: ticketIds },
    });

    if (tickets.length === 0) {
      return res.status(404).json({ message: "No tickets found." });
    }

    if (role === "agent") {
      const allAssigned = tickets.every((ticket) =>
        Array.isArray(ticket.assigned_to)
          ? ticket.assigned_to.some((id) => id.toString() === agentId)
          : ticket.assigned_to?.toString() === agentId
      );
      if (!allAssigned) {
        return res.status(401).json({
          message: "Access denied. Not all tickets are assigned to you.",
        });
      }
    }

    for (const ticket of tickets) {
      if (status) ticket.status = status;
      if (priority) ticket.priority = priority;
      if (assigned_to) ticket.assigned_to = assigned_to;

      await ticket.save();
    }

    return res
      .status(200)
      .json({ success: true, message: "Tickets updated successfully." });
  } catch (error) {
    console.error("multiTicketUpdate error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const handleWebhook = async (req, res) => {
  console.log("📥 Webhook received:", req.body);

  try {
    const data = req.body;

    if (!data.number) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: number",
      });
    }

    const normalizedNumber = data.number.replace(/^(\+91|91)/, "").trim();
    const defaultAgentId = "6871f47051c9213df93ebc01";
    const assignedTo = [new mongoose.Types.ObjectId(defaultAgentId)];

    const existingUser = await User.findOne({ number: normalizedNumber });

    const ticketPayload = {
      label: data.label || "webhook ticket",
      number: normalizedNumber,
      task: data.description || "Follow-up call",
      cropName: data.cropName || "NAP",
      assigned_to: assignedTo,
      created_By: new mongoose.Types.ObjectId(defaultAgentId),
      status: "Opened",
    };

    if (existingUser?._id) {
      ticketPayload.userId = existingUser._id;
    }

    const ticket = await Ticket.create(ticketPayload);

    return res.status(201).json({
      success: true,
      message: existingUser
        ? "User exists. Ticket created and linked to user."
        : "User not found. Ticket created without user reference.",
      ticket,
    });
  } catch (error) {
    console.error("❌ Error in handleWebhook:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
};
