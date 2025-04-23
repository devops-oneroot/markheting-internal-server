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

          // Get existing users
          const existingUsers = await User.find({
            number: { $in: formattedData.map((d) => d.number) },
          }).lean();

          const existingMap = new Map(
            existingUsers.map((user) => [user.number, user])
          );

          const bulkOperations = [];

          for (const { number, consentDate } of formattedData) {
            const user = existingMap.get(number);

            if (!user) {
              // New user
              bulkOperations.push({
                updateOne: {
                  filter: { number },
                  update: {
                    $set: {
                      consent: "yes",
                      consent_date: consentDate,
                    },
                  },
                  upsert: true,
                },
              });
            } else {
              const existingConsent = user.consent;
              const existingDate = user.consent_date;

              const shouldUpdate =
                existingConsent !== "yes" ||
                !existingDate ||
                new Date(existingDate) < new Date(consentDate);

              if (shouldUpdate) {
                bulkOperations.push({
                  updateOne: {
                    filter: { number },
                    update: {
                      $set: {
                        consent: "yes",
                        consent_date: consentDate,
                      },
                    },
                    upsert: false,
                  },
                });
              }
            }
          }

          const result =
            bulkOperations.length > 0
              ? await User.bulkWrite(bulkOperations)
              : { modifiedCount: 0, upsertedCount: 0 };

          const modifiedCount = result.modifiedCount || 0;
          const upsertedCount = result.upsertedCount || 0;
          const totalProcessed = formattedData.length;

          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file:", err);
          });

          return res.status(200).json({
            message: "CSV processed successfully",
            totalProcessed,
            modifiedCount,
            upsertedCount,
            skipped: totalProcessed - (modifiedCount + upsertedCount),
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
    console.error("Server error:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
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
