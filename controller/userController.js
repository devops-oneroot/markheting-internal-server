import User from "../model/user.model.js"; // Import your User model
import fs from "fs";
import csvParser from "csv-parser";

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
        let phone = null;
        let consentDate = null;

        // Extract phone number (considering both "Phone" and "phone" headers)
        if (data.Phone) {
          phone = data.Phone.trim();
        } else if (data.phone) {
          phone = data.phone.trim();
        }

        // Extract "Date of Addition" from CSV
        if (data["Date of Addition"]) {
          consentDate = data["Date of Addition"].trim();
        }

        if (phone) {
          if (phone.startsWith("0")) {
            phone = phone.substring(1); // Remove leading zero if present
          }
          csvPhones.push({ phone, consentDate });
        } else {
          console.log("No phone field found in row:", data);
        }
      })
      .on("end", async () => {
        try {
          const uniquePhoneData = new Map();

          // Remove duplicates while keeping the correct consentDate
          csvPhones.forEach(({ phone, consentDate }) => {
            if (!uniquePhoneData.has(phone) || consentDate) {
              uniquePhoneData.set(phone, consentDate);
            }
          });

          const formattedData = Array.from(uniquePhoneData.entries()).map(
            ([phone, consentDate]) => ({
              number: phone,
              consentDate: consentDate || null, // Ensure date is set
            })
          );

          console.log(
            "Unique phone numbers with consent dates:",
            formattedData
          );

          // Count total matching documents in the database
          const totalMatching = await User.countDocuments({
            number: { $in: formattedData.map((entry) => entry.number) },
          });

          // Prepare bulk update operations
          const bulkUpdates = formattedData.map(({ number, consentDate }) => ({
            updateOne: {
              filter: {
                number,
                $or: [
                  { consent: { $exists: false } },
                  { consent: { $ne: "yes" } },
                ],
              },
              update: {
                $set: { consent: "yes", consent_date: consentDate },
              },
            },
          }));

          // Execute bulk update
          const updateResult = await User.bulkWrite(bulkUpdates);

          // Safely compute updatedCount
          const updatedCount = updateResult.modifiedCount || 0;
          const skippedCount = totalMatching - updatedCount;

          // Delete CSV after processing
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
            else console.log("CSV file deleted:", filePath);
          });

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
            await User.insertMany(newRecords, { ordered: false });
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

export const concentAddAllowOverwrite = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const filePath = req.file.path;
    const csvPhones = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        let phone = data.Phone?.trim() || data.phone?.trim();
        let consentDate = data["Date of Addition"]?.trim() || null;

        if (phone) {
          if (phone.startsWith("0")) phone = phone.substring(1);
          csvPhones.push({ phone, consentDate });
        }
      })
      .on("end", async () => {
        try {
          const uniquePhoneData = new Map();
          csvPhones.forEach(({ phone, consentDate }) => {
            uniquePhoneData.set(phone, consentDate);
          });

          const formattedData = Array.from(uniquePhoneData.entries()).map(
            ([phone, consentDate]) => ({ number: phone, consentDate })
          );

          const bulkUpdates = formattedData.map(({ number, consentDate }) => ({
            updateOne: {
              filter: { number },
              update: { $set: { consent: "yes", consent_date: consentDate } },
            },
          }));

          const updateResult = await User.bulkWrite(bulkUpdates);
          const updatedCount = updateResult.modifiedCount || 0;

          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
          });

          return res.status(200).json({
            message: "CSV processed successfully",
            updatedCount,
          });
        } catch (error) {
          return res
            .status(500)
            .json({ error: "Error updating users", details: error.message });
        }
      })
      .on("error", (csvError) => {
        return res
          .status(500)
          .json({ error: "Error processing CSV", details: csvError.message });
      });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
};

export const updateDatabase = async (req, res) => {
  try {
    // fetch users from api
    const response = await fetch(`https://markhet-internal.onrender.com/users`);
    const apiUsers = await response.json();
    console.log(`fetched ${apiUsers.length} users from api`);

    // build map of api users keyed by normalized mobile number (without "+91")
    const apiUsersMap = new Map();
    for (const apiUser of apiUsers) {
      const normalizedNumber = apiUser.mobileNumber.replace(/^\+91/, "");
      apiUsersMap.set(normalizedNumber, apiUser);
    }

   // fetch database users with downloaded false
   const dbUsers = await User.find(
    { downloaded: null },
    { number: 1, downloaded: 1, downloaded_date: 1 }
  );
  console.log(
    `fetched ${dbUsers.length} users from database with downloaded false`
  );

  const updateOperations = [];
  let matchedCount = 0;

  // iterate through database users and update only those found in api data
  for (const dbUser of dbUsers) {
    const apiUser = apiUsersMap.get(dbUser.number);
    if (apiUser) {
      matchedCount++;
      let isDownloaded = false;
      let downloadedDate = "";
      if (apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy")) {
        isDownloaded = true;
        downloadedDate = new Date().toISOString();
      }
      console.log(
        `matched user ${dbUser.number}: api fcmToken = ${apiUser.fcmToken} | setting downloaded: ${isDownloaded}, downloaded_date: ${downloadedDate}`
      );
      updateOperations.push({
        updateOne: {
          filter: { number: dbUser.number },
          update: {
            $set: {
              downloaded: isDownloaded,
              downloaded_date: downloadedDate,
            },
          },
        },
      });
    } else {
        console.log(`no api match for database user ${dbUser.number}`);
      }
    }

    console.log(`total matched users: ${matchedCount}`);

    // perform bulk update if operations exist
    if (updateOperations.length > 0) {
      const bulkWriteResult = await User.bulkWrite(updateOperations);
      console.log(`bulk update result:`, bulkWriteResult);
    } else {
      console.log("no updates to perform.");
    }

    return res.status(200).json({
      message: "database updated successfully",
      updatedCount: updateOperations.length,
    });
  } catch (error) {
    console.error("error updating database:", error);
    return res.status(500).json({ message: "internal server error" });
  }
};


export const location =  async (req, res) => {
  const { pincode } = req.params;

  const baseUrl = process.env.LOCATION_API;
  if (!baseUrl) {
    console.error("❌ LOCATION_API is not defined in environment variables");
    return res.status(500).json({ error: "Server configuration error: LOCATION_API missing" });
  }

  try {
    const response = await fetch(`${baseUrl}/locations/${pincode}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch location data" });
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      return res.status(404).json({ error: "Invalid pincode or data not found" });
    }

    const locations = data.data.map(location => ({
      village: location.village,
      taluk: location.taluk,
      district: location.district
    }));

    res.json({ data: locations });
  } catch (err) {
    console.error("🔥 Error fetching location data:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
