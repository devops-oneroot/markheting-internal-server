import mongoose from "mongoose";
import connectDB from "./database/mongo.js"; // Your connection file
import fs from "fs";
import csvParser from "csv-parser";
import Farmer from "./model/user.model.js"; // Your model

// Get CSV file path from command line arguments
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error("Please provide the CSV file path as an argument.");
  process.exit(1);
}

// Function to process CSV file and insert new data into MongoDB
const processCSV = () => {
  const results = [];

  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on("data", (data) => {
      // If your CSV rows have an extra empty field (resulting in 8 keys instead of 7),
      // remap the data accordingly. Assuming the CSV columns are:
      // [name, number, identity, (empty), village, taluk, district, tag]
      const keys = Object.keys(data);
      if (keys.length === 8) {
        data = {
          name: data[keys[0]],
          number: data[keys[1]],
          identity: data[keys[2]],
          // Skip keys[3] because it's an extra empty field
          village: data[keys[4]],
          taluk: data[keys[5]],
          district: data[keys[6]],
          tag: data[keys[7]],
        };
      }
      results.push(data);
    })
    .on("end", async () => {
      try {
        // Extract phone numbers from CSV and remove extra whitespace.
        const csvNumbers = results.map((row) => row.number.trim());
        // Remove duplicates from the CSV numbers
        const uniqueNumbers = [...new Set(csvNumbers)];

        // Query the database for existing records with these numbers.
        const existingUsers = await Farmer.find(
          { number: { $in: uniqueNumbers } },
          { number: 1 }
        );
        const existingNumbers = existingUsers.map((user) => user.number);

        // Filter out records that already exist in the DB.
        const newRecords = results.filter(
          (row) => !existingNumbers.includes(row.number.trim())
        );

        console.log("Total records in CSV:", results.length);
        console.log("Unique numbers in CSV:", uniqueNumbers.length);
        console.log("Existing numbers in DB:", existingNumbers.length);
        console.log("New records to insert:", newRecords.length);

        if (newRecords.length > 0) {
          // Insert only new records (skip those whose number already exists).
          await Farmer.insertMany(newRecords, { ordered: false });
        }
        console.log("CSV data inserted successfully.");

        // Optionally, delete the file after processing
        fs.unlink(csvFilePath, (err) => {
          if (err) console.error("Error deleting file:", err);
          else console.log("CSV file deleted:", csvFilePath);
        });
        mongoose.disconnect();
      } catch (error) {
        console.error("Error processing CSV data:", error);
        mongoose.disconnect();
      }
    })
    .on("error", (error) => {
      console.error("Error reading CSV file:", error);
      process.exit(1);
    });
};

// Connect to MongoDB using your connectDB function and then process the CSV.
connectDB().then(() => {
  processCSV();
});
