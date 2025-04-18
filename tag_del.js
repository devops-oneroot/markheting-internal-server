import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./model/user.model.js"; // add `.js` if using ES modules

dotenv.config();

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

const del = async (tag) => {
  const res = await User.deleteMany({ tag });
  console.log("🗑️ Deleted users with tag:", tag, "Count:", res.deletedCount);
};

async function setPincodeNullIfMissing() {
  try {
    const res = await User.updateMany(
      { pincode: { $exists: false } }, // only update where `pincode` doesn't exist
      { $set: { pincode: null } }
    );

    console.log(`🛠️ Updated ${res.modifiedCount} users with pincode: null`);
  } catch (error) {
    console.error("❌ Error updating users:", error);
  }
}

// 👇 You need to define the tag first
const tag = "Mandya-1 Scraped"; // replace with your actual tag

connectMongo()
  .then(() => setPincodeNullIfMissing())
  .then(() => {
    console.log("✅ del del!");
    process.exit(0); // optional: exit the process after deletion
  });
