import User from "../model/user.model.js";
import fs from "fs";
import csvParser from "csv-parser";
import * as csvStringify from "csv-stringify";
import { createUserWithFieldsAndFlow } from "../whatsapp/updatewhatsapp.js";
import Bottleneck from "bottleneck";
import { Parser } from "json2csv";
import archiver from "archiver";

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 500,
});

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
                      identity: "Unknown",
                      tag: "csv_market_consent",
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

// 🔁 Retry logic for handling 429 rate limit errors
const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status !== 429) return res;

    console.warn(
      `⚠️ Got 429 Too Many Requests. Retrying in ${delay * (i + 1)}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
  }
  throw new Error("Too many requests - fetch failed after retries");
};

// ✅ Main controller
export const updateDatabase = async (req, res) => {
  try {
    console.log("Starting database update process…");

    // 1) Fetch users from the external API (with retry)
    const apiRes = await fetchWithRetry(
      "https://markhet-internal.onrender.com/users"
    );
    if (!apiRes.ok) {
      throw new Error(`API fetch failed with status ${apiRes.status}`);
    }
    const apiUsers = await apiRes.json();
    console.log(`Fetched ${apiUsers.length} users from API`);

    // 2) Normalize phone numbers & map by number
    const normalizePhone = (phone) => phone.replace(/^(\+91|\+)/, "").trim();
    const apiMap = new Map();
    for (const u of apiUsers) {
      apiMap.set(normalizePhone(u.mobileNumber), u);
    }

    // 3) Build a Set of all DB numbers (lean cursor)
    console.log("Building DB number set…");
    const dbNumberSet = new Set();
    for await (const { number } of User.find({}, { number: 1 })
      .lean()
      .cursor()) {
      dbNumberSet.add(normalizePhone(number));
    }
    console.log(`DB has ${dbNumberSet.size} users`);

    // 4) Batch‐update existing users who haven’t downloaded
    console.log("Batch‐updating existing users…");
    const BATCH_SIZE = 500;
    let updateOps = [];
    let updatedCount = 0;

    const updateCursor = User.find(
      { downloaded: { $in: [null, false] } },
      { number: 1, onboarded_date: 1, consent_date: 1 }
    )
      .lean()
      .cursor();

    for await (const dbUser of updateCursor) {
      const norm = normalizePhone(dbUser.number);
      const apiUser = apiMap.get(norm);
      console.log(dbUser, "dbuser");
      console.log(apiUser, "apiuser");
      console.log(norm, "norm");
      if (!apiUser) continue;

      const hasToken =
        apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");
      const updateSet = {
        downloaded: hasToken,
        downloaded_date: hasToken ? apiUser.createdAt : null,
        consent: "yes",
        onboarded_date: dbUser.onboarded_date ?? apiUser.createdAt,
        consent_date: dbUser.consent_date ?? apiUser.createdAt,
      };

      if (apiUser.identity && dbUser.identity !== apiUser.identity) {
        updateSet.identity =
          apiUser.identity === "FARMER" ? "Farmer" : "Harvester";
      }

      updateOps.push({
        updateOne: {
          filter: { number: dbUser.number },
          update: { $set: updateSet },
        },
      });

      if (updateOps.length >= BATCH_SIZE) {
        const r = await User.bulkWrite(updateOps);
        updatedCount += r.modifiedCount || 0;
        updateOps = [];
      }
    }

    if (updateOps.length) {
      const r = await User.bulkWrite(updateOps);
      updatedCount += r.modifiedCount || 0;
    }

    console.log(`Updated ${updatedCount} existing users`);

    // 5) Batch‐insert new users
    console.log("Batch‐inserting new users…");
    let insertedCount = 0;
    let insertBatch = [];

    for (const [norm, apiUser] of apiMap.entries()) {
      if (dbNumberSet.has(norm)) continue;

      const hasToken =
        apiUser.fcmToken && !apiUser.fcmToken.startsWith("dummy");

      insertBatch.push({
        number: norm,
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
        identity: apiUser.identity == "FARMER" ? "Farmer" : "Harvester",
        tag: `${
          apiUser.identity == "FARMER" ? "Farmer" : "Harvester"
        } Markhet_api`,
      });

      if (insertBatch.length >= BATCH_SIZE) {
        try {
          const inserted = await User.insertMany(insertBatch, {
            ordered: false,
          });
          insertedCount += inserted.length;
        } catch (err) {
          // Count partial successes if any duplicates          insertedCount += err.insertedDocs?.length || 0;
        }
        insertBatch = [];
      }
    }

    if (insertBatch.length) {
      try {
        const inserted = await User.insertMany(insertBatch, { ordered: false });
        insertedCount += inserted.length;
      } catch (err) {
        insertedCount += err.insertedDocs?.length || 0;
      }
    }

    console.log(`Inserted ${insertedCount} new users`);

    // 6) Final response
    return res.status(200).json({
      message: "Database updated successfully",
      updatedCount,
      insertedCount,
      totalApiUsers: apiUsers.length,
      totalDbUsers: dbNumberSet.size + insertedCount,
    });
  } catch (error) {
    console.error("Error updating database:", error);
    return res.status(500).json({
      message: "Internal server error",
      details: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
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

export const findNonOnboardedOrDownloadableUsers = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No CSV file uploaded" });

    const filePath = req.file.path;
    // Default to "Phone" column based on the CSV format
    const targetColumn =
      typeof req.body.columnName === "string" ? req.body.columnName : "Phone";

    const rows = [];
    let headersDetected = false;

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        if (!headersDetected) {
          // Ensure targetColumn exists in the headers
          if (!Object.keys(row).includes(targetColumn)) {
            return res
              .status(400)
              .json({ error: `Column '${targetColumn}' not found in CSV` });
          }
          headersDetected = true;
        }

        if (row[targetColumn] !== undefined) {
          // Clean the phone number by removing leading zeros
          let rawPhone = row[targetColumn].toString().trim();
          while (rawPhone.startsWith("0")) rawPhone = rawPhone.substring(1);
          rows.push({ original: row, phone: rawPhone });
        }
      })
      .on("end", async () => {
        // Clean up the uploaded file
        fs.unlink(filePath, () => {});

        if (rows.length === 0) {
          return res
            .status(400)
            .json({ error: `Column '${targetColumn}' not found or CSV empty` });
        }

        // Deduplicate by phone
        const uniqueByPhone = new Map();
        rows.forEach(({ original, phone }) => {
          if (!uniqueByPhone.has(phone)) uniqueByPhone.set(phone, original);
        });

        const uniquePhones = Array.from(uniqueByPhone.keys());

        // Query DB for users with these phone numbers
        // Now also check for downloaded:null
        const existingUsers = await User.find({
          number: { $in: uniquePhones },
          $or: [{ downloaded: null }, { downloaded: { $exists: false } }],
        })
          .lean()
          .select("number");

        const existingSet = new Set(existingUsers.map((u) => u.number));

        // Find users that exist in DB and have downloaded:null
        const downloadableUsers = uniquePhones.filter((p) =>
          existingSet.has(p)
        );
        const outputRows = downloadableUsers.map((p) => uniqueByPhone.get(p));

        // Prepare CSV response
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=downloadable_users.csv"
        );

        // If there are no users with downloaded:null, return empty CSV with headers
        if (outputRows.length === 0) {
          const headers = Object.keys(rows[0].original);
          csvStringify.stringify([headers], (err, output) => {
            if (err) {
              console.error("CSV generation error:", err);
              return res
                .status(500)
                .json({ error: "CSV generation error", details: err.message });
            }
            res.send(output);
          });
          return;
        }

        // Create CSV with data
        const headerFields = Object.keys(outputRows[0]);
        const data = outputRows.map((r) => headerFields.map((f) => r[f]));

        csvStringify.stringify([headerFields, ...data], (err, output) => {
          if (err) {
            console.error("CSV generation error:", err);
            return res
              .status(500)
              .json({ error: "CSV generation error", details: err.message });
          }
          res.send(output);
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        console.error("CSV parse error:", err);
        return res
          .status(500)
          .json({ error: "CSV parse error", details: err.message });
      });
  } catch (err) {
    console.error("Server error:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
};

export const sendMessageToNewUsers = async (req, res) => {
  try {
    // 1. Ensure a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }
    const filePath = req.file.path;

    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", async () => {
        const outcomes = await Promise.all(
          rows.map((row, idx) =>
            limiter.schedule(async () => {
              try {
                const { name, number, district, taluk, village } = row;

                // basic validation
                if (!name || !number) {
                  throw new Error("Missing required field: name or number");
                }

                // compute days to harvest if date provided
                let rthInDays = 7;

                const result = await createUserWithFieldsAndFlow({
                  phone: number,
                  name,
                  district,
                  taluk,
                  village,
                  rthInDays,
                });

                return { row: idx + 1, status: "success", result };
              } catch (err) {
                return {
                  row: idx + 1,
                  status: "error",
                  error: err.message || err.toString(),
                };
              }
            })
          )
        );

        // clean up the uploaded file if you like:
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.warn("Failed to delete temp CSV:", unlinkErr);
        });

        // 4. Summarize
        const successCount = outcomes.filter(
          (o) => o.status === "success"
        ).length;
        const failures = outcomes.filter((o) => o.status === "error");

        return res.json({
          total: rows.length,
          successCount,
          failures,
        });
      })
      .on("error", (err) => {
        console.error("CSV parse error:", err);
        return res.status(500).json({ error: "Failed to parse CSV" });
      });
  } catch (err) {
    console.error("sendMessageToNewUsers error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

export const AddUserNotes = async (req, res) => {
  try {
    const { number, note, agentId } = req.body;

    if (!number || typeof number !== "string") {
      return res.status(400).json({ error: "Valid phone number is required" });
    }

    if (!note || typeof note !== "string") {
      return res.status(400).json({ error: "Note is required" });
    }

    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const updateResult = await User.findOneAndUpdate(
      { number: number.trim() },
      {
        $push: {
          notes: {
            note: note.trim(),
            by: agentId.trim(),
            addedAt: new Date(),
          },
        },
      },
      { new: true } // returns the updated document
    );

    if (!updateResult) {
      return res
        .status(404)
        .json({ message: "User not found for this number" });
    }

    return res.status(200).json({ message: "Note added successfully" });
  } catch (error) {
    console.error("Error adding note:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRTHFarmersNumberCSV = async (req, res) => {
  try {
    const response = await fetch(
      `${process.env.MARKHET_API_URI}/crop/rth/number`
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch data from external API" });
    }

    const body = await response.json();

    if (body.code !== 200 || !body.data) {
      return res
        .status(400)
        .json({ error: "Invalid response format from external API" });
    }

    const { pakka_ready = [], maybe_ready = [] } = body.data;

    const parseToCSV = (data) => {
      const fields = ["first_name", "number"];
      const json2csvParser = new Parser({ fields });
      return json2csvParser.parse(
        data.map((item) => ({
          first_name: item.name,
          number: item.phoneNumber,
        }))
      );
    };

    const pakkaCSV = parseToCSV(pakka_ready);
    const maybeCSV = parseToCSV(maybe_ready);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=farmers_csvs.zip"
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);

    archive.append(pakkaCSV, { name: "pakka_ready_farmers.csv" });
    archive.append(maybeCSV, { name: "maybe_ready_farmers.csv" });

    await archive.finalize();
  } catch (err) {
    console.error("ZIP generation error:", err.message);
    return res.status(500).json({ error: "Failed to generate ZIP file" });
  }
};

export const getUserByNumber = async (req, res) => {
  try {
    const { number } = req.params;

    if (!number || typeof number !== "string") {
      return res.status(400).json({ error: "Valid phone number is required" });
    }

    const user = await User.findOne({ number: number.trim() }).lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found for this number" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user by number:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
