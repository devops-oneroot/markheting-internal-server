import mongoose from "mongoose";

const aiBotCallsSchema = new mongoose.Schema(
  {
    Date: { type: String, required: true },
    From: { type: String, required: true },
    RecordingURL: { type: String, required: true },
    To: { type: String, required: true },
    no_of_trees: { type: Number, default: 0 },
    has_added: { type: Boolean, default: false },
     harvest: { type: String, required: true },
    crop: {
      type: String,
    },
    duration: { type: String, required: true },
   
  },
  { timestamps: true }
);

const AiBotCalls = mongoose.model("AiBot", aiBotCallsSchema);

export default AiBotCalls;