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
        // Normalize phone and consent date
        let phone = data.Phone?.trim() || data.phone?.trim();
        const consentDate = data["Date of Addition"]?.trim() || null;

        if (phone) {
          if (phone.startsWith("0")) phone = phone.substring(1);
          csvPhones.push({ phone, consentDate });
        } else {
          console.log("No phone field found in row:", data);
        }
      })
      .on("end", async () => {
        try {
          // Deduplicate, preferring rows with a consentDate
          const uniquePhoneMap = new Map();
          csvPhones.forEach(({ phone, consentDate }) => {
            if (!uniquePhoneMap.has(phone) || consentDate) {
              uniquePhoneMap.set(phone, consentDate);
            }
          });

          const formattedData = Array.from(
            uniquePhoneMap,
            ([number, consentDate]) => ({ number, consentDate })
          );

          // Prepare bulk upsert operations
          const bulkOperations = formattedData.map(
            ({ number, consentDate }) => ({
              updateOne: {
                filter: { number },
                update: { $set: { consent: "yes", consent_date: consentDate } },
                upsert: true,
              },
            })
          );

          // Execute bulkWrite
          const result = await User.bulkWrite(bulkOperations);

          // Statistics
          const modifiedCount = result.modifiedCount || 0;
          const upsertedCount = result.upsertedCount || 0;
          const totalProcessed = formattedData.length;

          // Clean up CSV file
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
          });

          return res.status(200).json({
            message: "CSV processed successfully",
            totalProcessed,
            modifiedCount,
            upsertedCount,
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
        return res
          .status(500)
          .json({ error: "Error processing CSV", details: csvError.message });
      });
  } catch (error) {
    console.error("Server error:", error);
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

        // Remove any empty key (possible due to an extra column).
        if (normalizedData[""] !== undefined) {
          delete normalizedData[""];
        }

        results.push(normalizedData);
      })
      .on("end", async () => {
        try {
          // Extract and trim the 'number' field from each row.
          const csvNumbers = results
            .map((row) => (row.number ? row.number.trim() : ""))
            .filter((num) => num !== "");

          // Create a set of unique numbers for querying existing users in the DB.
          const uniqueNumbers = [...new Set(csvNumbers)];
          console.log("Unique phones extracted from CSV:", uniqueNumbers);

          // Query the database for existing users based on these numbers.
          const existingUsers = await User.find(
            { number: { $in: uniqueNumbers } },
            { number: 1 }
          );
          const existingNumbers = existingUsers.map((user) => user.number);

          // Filter out rows that already exist in the DB and also deduplicate entries from CSV,
          // only inserting the first occurrence.
          const newRecords = [];
          const seenNumbers = new Set();
          results.forEach((row) => {
            if (row.number) {
              const trimmedNumber = row.number.trim();
              // If number does not exist in DB and has not yet been processed, add it
              if (
                !existingNumbers.includes(trimmedNumber) &&
                !seenNumbers.has(trimmedNumber)
              ) {
                seenNumbers.add(trimmedNumber);
                newRecords.push(row);
              }
            }
          });

          console.log("Total records in CSV:", results.length);
          console.log("Unique numbers in CSV:", uniqueNumbers.length);
          console.log("Existing numbers in DB:", existingNumbers.length);
          console.log("New records to insert:", newRecords.length);

          // Insert only the new records.
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
    // 1) Fetch users from the external API
    const response = await fetch("https://markhet-internal.onrender.com/users");
    const apiUsers = await response.json();
    console.log(`fetched ${apiUsers.length} users from api`);

    // 2) Build a map of API users keyed by normalized mobile number (without "+91")
    const apiUsersMap = new Map();
    for (const apiUser of apiUsers) {
      const normalized = apiUser.mobileNumber.replace(/^\+91/, "");
      apiUsersMap.set(normalized, apiUser);
    }

    // 3) Fetch database users with downloaded=false or null
    const dbUsers = await User.find(
      { downloaded: { $in: [null, false] } },
      { number: 1, onboarded_date: 1, consent_date: 1 }
    );
    console.log(
      `fetched ${dbUsers.length} users from database with downloaded false`
    );

    // Collect existing DB numbers for later
    const dbNumbers = new Set(dbUsers.map((u) => u.number));

    // 4) Prepare bulk update operations
    const updateOperations = [];
    let matchedCount = 0;

    for (const dbUser of dbUsers) {
      const apiUser = apiUsersMap.get(dbUser.number);
      if (!apiUser) {
        console.log(`no api match for database user ${dbUser.number}`);
        continue;
      }

      matchedCount++;
      const hasRealToken =
        apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");
      const downloadedDate = hasRealToken ? apiUser.createdAt : "";
      const onboardedDate = dbUser.onboarded_date || apiUser.createdAt;
      const consentDate = dbUser.consent_date || apiUser.createdAt;

      console.log(
        `matched user ${dbUser.number}: api fcmToken = ${apiUser.fcmToken} | setting downloaded: ${hasRealToken}, downloaded_date: ${downloadedDate}`
      );

      updateOperations.push({
        updateOne: {
          filter: { number: dbUser.number },
          update: {
            $set: {
              downloaded: hasRealToken,
              downloaded_date: downloadedDate,
              consent: "yes",
              onboarded_date: onboardedDate,
              consent_date: consentDate,
            },
          },
        },
      });
    }

    console.log(`total matched users for update: ${matchedCount}`);

    // Execute bulk update
    if (updateOperations.length > 0) {
      const bulkWriteResult = await User.bulkWrite(updateOperations);
      console.log("bulk update result:", bulkWriteResult);
    } else {
      console.log("no updates to perform.");
    }

    // 5) Create API-users not yet in the DB
    const newUsers = [];
    for (const [number, apiUser] of apiUsersMap.entries()) {
      if (!dbNumbers.has(number)) {
        const hasRealToken =
          apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");
        newUsers.push({
          number: apiUser.mobileNumber,
          downloaded: hasRealToken,
          downloaded_date: hasRealToken ? apiUser.createdAt : null,
          consent: "yes",
          onboarded_date: apiUser.createdAt,
          consent_date: apiUser.createdAt,
          pincode: apiUser.pincode,
          name: apiUser.name,
          taluk: apiUser.taluk,
          district: apiUser.district,
          village: apiUser.village,
        });
      }
    }
    console.log(`new users to insert: ${newUsers.length}`);

    let insertedCount = 0;
    if (newUsers.length > 0) {
      const inserted = await User.insertMany(newUsers, { ordered: false });
      insertedCount = inserted.length;
      console.log(`inserted ${insertedCount} new users`);
    } else {
      console.log("no new users to insert.");
    }

    // 6) Send final response
    return res.status(200).json({
      message: "database updated successfully",
      updatedCount: updateOperations.length,
      insertedCount,
    });
  } catch (error) {
    console.error("error updating database:", error);
    return res
      .status(500)
      .json({ message: "internal server error", details: error.message });
  }
};

export const location = async (req, res) => {
  const { pincode } = req.params;

  const baseUrl = process.env.LOCATION_API;
  if (!baseUrl) {
    console.error("❌ LOCATION_API is not defined in environment variables");
    return res
      .status(500)
      .json({ error: "Server configuration error: LOCATION_API missing" });
  }

  try {
    const response = await fetch(`${baseUrl}/locations/${pincode}`);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch location data" });
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      return res
        .status(404)
        .json({ error: "Invalid pincode or data not found" });
    }

    const locations = data.data.map((location) => ({
      village: location.village,
      taluk: location.taluk,
      district: location.district,
    }));

    res.json({ data: locations });
  } catch (err) {
    console.error("🔥 Error fetching location data:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
