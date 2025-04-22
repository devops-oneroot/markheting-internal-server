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
    console.log("Starting database update process...");

    // 1) Fetch users from the external API
    const apiRes = await fetch(
      "https://markhet-internal.onrender.com/users/farmer"
    );

    if (!apiRes.ok) {
      throw new Error(`API fetch failed with status ${apiRes.status}`);
    }

    const { data: apiUsers = [] } = await apiRes.json();
    console.log(`Fetched ${apiUsers.length} users from API`);

    // 2) Normalize phone numbers and create a map
    const normalizePhone = (phone) => {
      return phone.replace(/^(\+91|91|\+)/, "").trim();
    };

    const apiMap = new Map();
    for (const user of apiUsers) {
      const normalizedNumber = normalizePhone(user.mobileNumber);
      apiMap.set(normalizedNumber, user);
    }

    // 3) Get all existing users from DB to avoid duplicates
    const allDbUsers = await User.find({}, "number");
    const dbNumberSet = new Set(
      allDbUsers.map((user) => normalizePhone(user.number))
    );
    console.log(`Database currently has ${dbNumberSet.size} users`);

    // 4) Get users that need updating
    const dbUsersToUpdate = await User.find(
      { downloaded: { $in: [null, false] } },
      "number onboarded_date consent_date"
    );
    console.log(`Found ${dbUsersToUpdate.length} users that need updating`);

    // 5) Build bulk update operations
    const updates = [];
    for (const dbUser of dbUsersToUpdate) {
      const normalizedNumber = normalizePhone(dbUser.number);
      const apiUser = apiMap.get(normalizedNumber);

      if (!apiUser) {
        console.log(`No API match for DB user: ${normalizedNumber}`);
        continue;
      }

      const hasToken =
        apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");
      updates.push({
        updateOne: {
          filter: { number: dbUser.number },
          update: {
            $set: {
              downloaded: hasToken,
              downloaded_date: hasToken ? apiUser.createdAt : "",
              consent: "yes",
              onboarded_date: dbUser.onboarded_date ?? apiUser.createdAt,
              consent_date: dbUser.consent_date ?? apiUser.createdAt,
            },
          },
        },
      });
    }

    // 6) Perform bulk updates
    let updateResult = { modifiedCount: 0 };
    if (updates.length > 0) {
      updateResult = await User.bulkWrite(updates);
      console.log(`Updated ${updateResult.modifiedCount} existing users`);
    }

    // 7) Prepare new users for insertion
    const newUsers = [];
    const skippedUsers = [];

    for (const [normalizedNumber, apiUser] of apiMap.entries()) {
      if (dbNumberSet.has(normalizedNumber)) {
        continue;
      }

      const hasToken =
        apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");
      newUsers.push({
        number: normalizedNumber,
        downloaded: hasToken,
        downloaded_date: hasToken ? apiUser.createdAt : null,
        consent: "yes",
        onboarded_date: apiUser.createdAt,
        consent_date: apiUser.createdAt,
        pincode: apiUser.pincode,
        name: apiUser.name,
        taluk: apiUser.taluk,
        district: apiUser.district,
        village: apiUser.village,
        identity: "Farmer",
        tag: "Markhet_api",
      });
    }

    console.log(`Found ${newUsers.length} new users to insert`);

    // 8) Insert new users with error handling for duplicates
    let insertedCount = 0;
    if (newUsers.length > 0) {
      try {
        // Insert in batches to handle large volumes better
        const BATCH_SIZE = 100;
        for (let i = 0; i < newUsers.length; i += BATCH_SIZE) {
          const batch = newUsers.slice(i, i + BATCH_SIZE);
          try {
            const inserted = await User.insertMany(batch, { ordered: false });
            insertedCount += inserted.length;
          } catch (batchError) {
            if (batchError.writeErrors) {
              // Count successful inserts even when some fail
              const successfulInserts = batchError.insertedDocs?.length || 0;
              insertedCount += successfulInserts;
              console.log(
                `Batch had ${successfulInserts} successful inserts and ${batchError.writeErrors.length} errors`
              );
            } else {
              throw batchError; // Rethrow if it's not a duplicate key error
            }
          }
        }
      } catch (insertError) {
        console.error("Error during bulk insertion:", insertError);
      }
    }

    console.log(`Successfully inserted ${insertedCount} new users`);

    // 9) Send response
    return res.status(200).json({
      message: "Database updated successfully",
      updatedCount: updateResult.modifiedCount,
      insertedCount,
      totalApiUsers: apiUsers.length,
      totalDbUsers: dbNumberSet.size + insertedCount,
    });
  } catch (error) {
    console.error("Error updating database:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
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
