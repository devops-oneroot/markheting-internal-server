import FieldTicket from "../model/fieldTicket.model.js";

export const createTicket = async (req, res) => {
  try {
    const {
      field_guyId,
      farmerId,
      farmername,
      village,
      taluk,
      district,
      reportedNHD,
      cropName,
      farmernumber,
      cropId,
      dueDate,
      priority = "MEDIUM",
      status = "pending",
    } = req.body;

    if (
      !field_guyId ||
      !farmerId ||
      !farmername ||
      !village ||
      !district ||
      !reportedNHD ||
      !farmernumber ||
      !cropName ||
      !cropId
    ) {
      return res.status(400).json({ message: "Missing required field(s)" });
    }

    const ticket = await FieldTicket.create({
      field_guyId,
      farmerId,
      farmername,
      village,
      taluk,
      farmernumber,
      district,
      reportedNHD,
      cropName,
      cropId,
      priority,
      status,
      dueDate,
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error("Error creating ticket:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getOpenTicketsByFieldGuy = async (req, res) => {
  try {
    const { fielduserId } = req.params;
    const doneStatuses = ["not-ready", "farm-didnt-pick", "submitted"];

    // Build “today” bounds
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Define the priority ordering we want
    const priorityOrder = ["ASAP", "HIGH", "MEDIUM", "LOW"];

    const tickets = await FieldTicket.aggregate([
      // 1) match only open tickets for this field‐guy
      {
        $match: {
          field_guyId: fielduserId,
          status: { $nin: doneStatuses },
        },
      },

      // 2) compute numeric ranks for priority & due‐status
      {
        $addFields: {
          priorityRank: { $indexOfArray: [priorityOrder, "$priority"] },
          dueRank: {
            $switch: {
              branches: [
                {
                  case: { $lt: ["$dueDate", todayStart] },
                  then: 0,
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$dueDate", todayStart] },
                      { $lt: ["$dueDate", todayEnd] },
                    ],
                  },
                  then: 1,
                },
              ],
              default: 2,
            },
          },
        },
      },

      {
        $sort: {
          priorityRank: 1,
          dueRank: 1,
          dueDate: 1,
          createdAt: -1,
        },
      },

      {
        $project: {
          priorityRank: 0,
          dueRank: 0,
        },
      },
    ]);

    return res.status(200).json(tickets);
  } catch (err) {
    console.error("Error fetching open tickets:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ message: "Missing `status` in request body." });
    }

    const allowed = [
      "pending",
      "called",
      "on-the-way",
      "visited",
      "not-ready",
      "farm-didnt-pick",
      "submitted",
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status: ${status}` });
    }

    const ticket = await FieldTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: `Ticket ${id} not found.` });
    }

    ticket.status = status;
    await ticket.save();

    return res.status(200).json(ticket);
  } catch (err) {
    console.error("Error updating ticket status:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
