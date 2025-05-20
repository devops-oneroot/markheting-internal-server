import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  task: {
    type: String,
    required: true,
  },
  assigned_to: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
  ],
  priority: {
    type: String,
    enum: ["low", "medium", "high", "ASAP"],
    default: "medium",
    required: true,
  },
  cropName: {
    type: String,
    enum: ["Tender Coconut", "Dry Coconut", "Turmeric", "Banana", "NAP"],
    default: "NAP",
    required: true,
  },
  remarks: [
    {
      type: String,
      time: {
        type: Date,
        default: Date.now(),
      },
    },
  ],
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending" | "Closed" | "Opened" | "Waiting For"],
    default: "Pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
