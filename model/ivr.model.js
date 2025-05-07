import mongoose from "mongoose";

const ivrSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
    },
    pressed: {
      type: String,
      default: null,
    },
    tag: {
      type: String,
      required: true,
      default: null,
    },
    called_date: {
      type: String,
      default: null,
    },
  },
  { Timestamp: true }
);

const IVR = mongoose.model("IVR", ivrSchema);

export default IVR;
