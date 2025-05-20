import Ticket from "../model/ticket.model.js";

export const createTicket = async (req, res) => {
  try {
    const { userId, task, assigned_to = [], priority } = req.body;

    console.log(userId, task);

    if (!userId || !task) {
      return res
        .status(400)
        .json({ message: "userId and task are required to create a ticket." });
    }

    const ticket = await Ticket.create({
      userId,
      task,
      assigned_to,
      priority,
    });

    return res.status(201).json({
      message: "Ticket created successfully.",
      ticket,
    });
  } catch (error) {
    console.error("createTicket error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
