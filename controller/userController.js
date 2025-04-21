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
    const rows = [];

    // 1. Read & normalize CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (data) => {
          const normalized = {};
          Object.entries(data).forEach(([key, val]) => {
            const k = key.trim().toLowerCase();
            if (k) normalized[k] = typeof val === "string" ? val.trim() : val;
          });
          rows.push(normalized);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // 2. Extract unique phone numbers
    const csvNumbers = rows
      .map((r) => r.number)
      .filter((num) => typeof num === "string" && num !== "");
    const uniqueNumbers = [...new Set(csvNumbers)];

    // 3. Fetch existing users
    const existingUsers = await User.find({
      number: { $in: uniqueNumbers },
    }).lean();
    const existingMap = existingUsers.reduce((m, u) => {
      m[u.number] = u;
      return m;
    }, {});

    // 4. Prepare bulk operations
    const seenNew = new Set();
    const bulkOps = [];

    for (const row of rows) {
      const num = row.number;
      if (!num) continue;

      if (existingMap[num]) {
        // existing user → check for missing fields
        const dbUser = existingMap[num];
        const toSet = {};
        for (const [key, val] of Object.entries(row)) {
          if (key === "number") continue;
          // only update if CSV has a non‑empty value AND dbUser is missing it
          if (
            val !== "" &&
            (dbUser[key] === undefined ||
              dbUser[key] === null ||
              dbUser[key] === "")
          ) {
            toSet[key] = val;
          }
        }
        if (Object.keys(toSet).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { number: num },
              update: { $set: toSet },
            },
          });
        }
      } else {
        // new user → dedupe within CSV
        if (!seenNew.has(num)) {
          seenNew.add(num);
          bulkOps.push({
            insertOne: { document: row },
          });
        }
      }
    }

    // 5. Execute bulkWrite
    let bulkResult = { insertedCount: 0, modifiedCount: 0 };
    if (bulkOps.length > 0) {
      const result = await User.bulkWrite(bulkOps, { ordered: false });
      bulkResult.insertedCount = result.insertedCount || 0;
      bulkResult.modifiedCount = result.modifiedCount || 0;
    }

    // 6. Clean up CSV file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });

    // 7. Respond
    return res.status(200).json({
      message: "CSV processed successfully",
      totalRows: rows.length,
      uniqueNumbers: uniqueNumbers.length,
      insertedRecords: bulkResult.insertedCount,
      updatedRecords: bulkResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error in importCsv:", error);
    return res.status(500).json({
      error: "Server error during CSV import",
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
      { downloaded: { $in: [null, false] } },
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
        const onBoardDate = dbUser.onboarded_date
          ? dbUser.consent_date
          : apiUser.createdAt;
        const concentDate = dbUser.consent_date
          ? dbUser.consent_date
          : apiUser.createdAt;
        if (apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy")) {
          isDownloaded = true;
          downloadedDate = apiUser.createdAt;
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
                consent: "yes",
                onboarded_date: onBoardDate,
                consent_date: concentDate,
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
