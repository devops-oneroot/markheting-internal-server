import User from "../model/user.model.js"; // Import your User model
import fs from "fs";
import csvParser from "csv-parser";

// Helper function to format a Date as "YYYY-MM-DD HH:mm:ss"
const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = ("0" + (date.getMonth() + 1)).slice(-2);
  const dd = ("0" + date.getDate()).slice(-2);
  const hh = ("0" + date.getHours()).slice(-2);
  const min = ("0" + date.getMinutes()).slice(-2);
  const ss = ("0" + date.getSeconds()).slice(-2);
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

export const concentAdd = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const filePath = req.file.path;
    const csvPhones = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        // Check for both "Phone" and "phone" headers
        let phone = null;
        if (data.Phone) {
          phone = data.Phone.trim();
        } else if (data.phone) {
          phone = data.phone.trim();
        }

        if (phone) {
          // Remove leading "0" if it exists
          if (phone.startsWith("0")) {
            phone = phone.substring(1);
          }
          csvPhones.push(phone);
          console.log("Extracted phone:", phone);
        } else {
          console.log("No phone field found in row:", data);
        }
      })
      .on("end", async () => {
        try {
          // Remove duplicate phone numbers to optimize the update query
          const uniquePhones = [...new Set(csvPhones)];
          console.log("Unique phones extracted from CSV:", uniquePhones);
          const formattedDate = formatDate(new Date());

          // Count total matching documents in the database
          const totalMatching = await User.countDocuments({
            number: { $in: uniquePhones },
          });

          // Update only users whose consent is not already "yes"
          const updateFilter = {
            number: { $in: uniquePhones },
            $or: [{ consent: { $exists: false } }, { consent: { $ne: "yes" } }],
          };

          const updateResult = await User.updateMany(updateFilter, {
            $set: { consent: "yes", consent_date: formattedDate },
          });

          // Safely compute updatedCount using modifiedCount or nModified, defaulting to 0
          const updatedCount =
            typeof updateResult.modifiedCount === "number"
              ? updateResult.modifiedCount
              : typeof updateResult.nModified === "number"
              ? updateResult.nModified
              : 0;
          const skippedCount = totalMatching - updatedCount;

          // Delete the CSV file after processing.
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
            else console.log("CSV file deleted:", filePath);
          });

          console.log("Update result:", updateResult);
          return res.status(200).json({
            message: "CSV processed successfully",
            totalRecords: totalMatching,
            updatedCount,
            skippedCount,
          });
        } catch (updateError) {
          console.error("Error updating users:", updateError);
          return res.status(500).json({
            error: "Error updating users",
            details: updateError.message,
          });
        }
      })
      .on("error", (csvError) => {
        console.error("Error processing CSV:", csvError);
        return res.status(500).json({
          error: "Error processing CSV",
          details: csvError.message,
        });
      });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

export const importCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        // Normalize all keys to lowercase.
        const normalizedData = {};
        Object.keys(data).forEach((key) => {
          normalizedData[key.toLowerCase()] = data[key];
        });

        // If there's an empty key (which can occur due to an extra column), remove it.
        if (normalizedData[""] !== undefined) {
          delete normalizedData[""];
        }

        results.push(normalizedData);
      })
      .on("end", async () => {
        try {
          // Extract the 'number' field (now all keys are lowercase) and trim whitespace.
          const csvNumbers = results
            .map((row) => (row.number ? row.number.trim() : ""))
            .filter((num) => num !== "");

          // Remove duplicate phone numbers.
          const uniqueNumbers = [...new Set(csvNumbers)];
          console.log("Unique phones extracted from CSV:", uniqueNumbers);

          // Query the database for existing users based on these numbers.
          const existingUsers = await User.find(
            { number: { $in: uniqueNumbers } },
            { number: 1 }
          );
          const existingNumbers = existingUsers.map((user) => user.number);

          // Filter out rows that already exist in the DB.
          const newRecords = results.filter(
            (row) => row.number && !existingNumbers.includes(row.number.trim())
          );

          console.log("Total records in CSV:", results.length);
          console.log("Unique numbers in CSV:", uniqueNumbers.length);
          console.log("Existing numbers in DB:", existingNumbers.length);
          console.log("New records to insert:", newRecords.length);

          // Insert only new records.
          if (newRecords.length > 0) {
            await Farmer.insertMany(newRecords, { ordered: false });
          }
          console.log("CSV data inserted successfully.");

          // Delete the CSV file after processing.
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
            else console.log("CSV file deleted:", filePath);
          });

          return res.status(200).json({
            message: "CSV processed successfully",
            totalRecords: results.length,
            uniqueNumbers: uniqueNumbers.length,
            existingNumbers: existingNumbers.length,
            insertedRecords: newRecords.length,
          });
        } catch (error) {
          console.error("Error processing CSV data:", error);
          return res.status(500).json({
            error: "Error processing CSV data",
            details: error.message,
          });
        }
      })
      .on("error", (error) => {
        console.error("Error reading CSV file:", error);
        return res.status(500).json({
          error: "Error reading CSV file",
          details: error.message,
        });
      });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};
