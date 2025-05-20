import mongoose, { Schema } from "mongoose";

const AgentSchema = new Schema(
  {
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["agent", "admin"], default: "agent" },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const Agent = mongoose.model("Agent", AgentSchema);

export default Agent;
