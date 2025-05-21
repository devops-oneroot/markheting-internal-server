import mongoose, { Schema } from "mongoose";

const AgentSchema = new Schema(
  {
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["agent", "admin"],
      default: "agent",
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AgentSchema.index({ role: 1, phoneNumber: 1 });

const Agent = mongoose.model("Agent", AgentSchema);

export default Agent;
