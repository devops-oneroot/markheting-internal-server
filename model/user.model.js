import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    village: { type: String },
    taluk: { type: String },
    district: { type: String },
    number: { type: String, required: true, unique: true },
    identity: { type: String, enum: ["Buyer", "Farmer"], required: true },
    tag: { type: String },
    consent: String,
    consent_date: String,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
