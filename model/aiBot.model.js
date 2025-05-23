import mongoose from "mongoose";

const aiBotCallsSchema = new mongoose.Schema(
  {
    Date: { type: String, required: true },
    Format: { type: String, required: true },
    From: { type: String, required: true },
    ProratedStorageCost: { type: String, required: true },
    RecordingType: { type: String, required: true },
    RecordingURL: { type: String, required: true },
    To: { type: String, required: true },
    no_of_trees: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const AiBotCalls = mongoose.model("AiBot", aiBotCallsSchema);

export default AiBotCalls;
