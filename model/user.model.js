import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    gov_farmer_id: { type: String, default: null },
    age: { type: Number, default: null },
    hobli: { type: String, default: null },
    farmer_category: { type: String, default: null },
    village: { type: String },
    taluk: { type: String },
    district: { type: String },
    number: { type: String, required: true, unique: true },
    identity: {
      type: String,
      enum: ["Harvester", "Farmer", "Loader", "Unknown"],
      required: true,
    },
    tag: { type: String },
    consent: { type: String, default: null },
    consent_date: { type: Date, default: null },
    downloaded: { type: Boolean, default: null },
    downloaded_date: { type: String, default: null },
    onboarded_date: { type: String, default: null },
    pincode: { type: Number, default: null },
    coordinates: { type: String, default: null },
    notes: [
      {
        note: { type: String },
        time: {
          type: Date,
          default: Date.now(),
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Agent",
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
