import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  created_By: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },
  number: {
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  task: {
    type: String,
    required: true,
  },
  assigned_to: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
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
      remark: { type: String, required: true },
      time: { type: Date, default: Date.now },
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
      },
    },
  ],
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["Opened", "Waiting For", "Closed"],
    default: "Opened",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
