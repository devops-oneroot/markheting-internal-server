import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    village: { type: String, required: true },
    taluk: { type: String, required: true },
    district: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    identity: { type: String, enum: ["Buyer", "Farmer"], required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
