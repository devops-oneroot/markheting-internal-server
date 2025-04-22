import mongoose from "mongoose";

const reportEntrySchema = new mongoose.Schema({
  cropname: {
    type: String,
    default: "",
    trim: true,
  },
  number: {
    type: String,
    required: true,
    match: [
      /^\+?\d+$/,
      "Phone number must be digits, optionally starting with +",
    ],
  },
  given_on: {
    type: Date,
    default: Date.now,
  },
  ready: {
    type: Boolean,
    default: false,
  },
  next_RTH_in_days: {
    type: Number,
    default: null,
  },
});

const plivoCampaignSchema = new mongoose.Schema(
  {
    campaign_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    campaign_report: {
      type: [reportEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const PlivoReport = mongoose.model("PlivoReport", plivoCampaignSchema);
export default PlivoReport;
