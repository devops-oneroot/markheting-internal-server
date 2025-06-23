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
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error("Error creating ticket:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getOpenTicketsByFieldGuy = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const doneStatuses = ["not-ready", "farm-didnt-pick", "submitted"];

    const tickets = await FieldTicket.find({
      field_guyId: fieldId,
      status: { $nin: doneStatuses },
    }).sort({ createdAt: -1 });

    return res.status(200).json(tickets);
  } catch (err) {
    console.error("Error fetching open tickets:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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
