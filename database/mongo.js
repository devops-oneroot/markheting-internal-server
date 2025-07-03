import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  const options = {
    // These are defaults in Mongoose 6+, but explicitly setting helps with clarity
    serverSelectionTimeoutMS: 10000, // Wait up to 10s for a server
    socketTimeoutMS: 45000, // Time to wait before socket times out
    maxPoolSize: 20, // Max number of concurrent connections
    heartbeatFrequencyMS: 10000, // Monitor interval
  };

  try {
    await mongoose.connect(process.env.MONGO_URI, options);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);

    process.exit(1); // Exit on failure
  }
};

export default connectDB;
