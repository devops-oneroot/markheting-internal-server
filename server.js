import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";
import userRoute from "./routes/userRoute.js";
import plivoRoute from "./routes/plivo.route.js";
import plivoReportRoute from "./routes/plivoReport.route.js";
import { createUserAndSendFlow } from "./whatsapp.js";
import { Parser } from "json2csv";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    const app = express();

    // Global middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());

    // Mount modular routes
    app.use(userRoute);
    app.use(plivoRoute);
    app.use(plivoReportRoute);

    // Basic health-check
    app.get("/", (req, res) => {
      res.send("Welcome to market dashboard");
    });

    // Fetch distinct tags
    app.get("/tags", async (req, res) => {
      try {
        const tags = await User.distinct("tag", { tag: { $nin: [null, ""] } });
        res.json(tags.filter(Boolean));
      } catch (err) {
        console.error("Error fetching tags:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Fetch users with filters
    app.get("/users", async (req, res) => {
      try {
        const { page = 1, tag, consent, downloaded, date, search } = req.query;
        const limit = 50;
        const skip = (page - 1) * limit;
        const query = buildUserQuery({
          tag,
          consent,
          downloaded,
          date,
          search,
        });

        const [users, totalUsers] = await Promise.all([
          User.find(query).skip(skip).limit(limit),
          User.countDocuments(query),
        ]);

        res.json({
          users,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
        });
      } catch (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Download CSV of filtered users
    app.get("/download-users", async (req, res) => {
      try {
        const { tag, consent, date, downloaded, columns } = req.query;
        const query = buildUserQuery({ tag, consent, downloaded, date });
        const fields = selectCsvFields(columns); // e.g. ['_id','email','createdAt',…]
        const filename = `users_${tag || "all"}_${Date.now()}.csv`;

        // 1) Set headers up front
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        // 2) Create a Mongoose cursor (no .exec() in memory)
        const cursor = User.find(query).lean().cursor();

        // 3) Create a CSV formatter stream
        const csvStream = format({ headers: fields, writeHeaders: true });

        // 4) Pipe CSV directly to the response
        csvStream.pipe(res).on("error", (err) => {
          console.error("CSV stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });

        // 5) As each doc comes in, write its row
        cursor.on("data", (doc) => {
          // pick only requested fields
          const row = fields.reduce((acc, key) => {
            acc[key] = doc[key];
            return acc;
          }, {});
          csvStream.write(row);
        });

        cursor.on("end", () => {
          csvStream.end();
        });

        cursor.on("error", (err) => {
          console.error("Mongo cursor error:", err);
          csvStream.end();
        });
      } catch (err) {
        console.error("Unexpected error generating CSV:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    });

    // Webhook endpoint (handles both broadcast and call link)
    app.get("/webhook", handleWebhook);

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Utilities and handlers
function buildUserQuery({ tag, consent, downloaded, date, search }) {
  const query = {};
  if (tag) query.tag = tag;
  if (consent)
    query.consent = consent === "yes" ? "yes" : { $in: ["", null, "no"] };
  if (downloaded === "yes") query.downloaded = true;
  else if (downloaded === "no") query.downloaded = false;
  else if (downloaded === "null") query.downloaded = null;
  if (date) query.consent_date = { $regex: `^${date}` };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { number: { $regex: search, $options: "i" } },
    ];
  }
  return query;
}

function selectCsvFields(columns) {
  const allowed = [
    "name",
    "gov_farmer_id",
    "age",
    "pincode",
    "hobli",
    "farmer_category",
    "village",
    "taluk",
    "district",
    "number",
    "identity",
    "tag",
    "consent",
    "consent_date",
    "createdAt",
    "updatedAt",
    "downloaded",
    "downloaded_date",
    "coordinates",
  ];
  if (!columns) return allowed;
  const requested = columns.split(",");
  return requested.filter((col) => allowed.includes(col));
}

async function handleWebhook(req, res) {
  try {
    let { CallFrom: callFrom, type } = req.query;
    if (!callFrom) return res.status(400).send("Missing CallFrom");

    // Normalize phone number
    if (callFrom.startsWith("0")) callFrom = callFrom.slice(1);
    const phone = `91${callFrom}`;
    const flowType = type === "call link" ? "call link" : "broadcast";

    setImmediate(() => {
      createUserAndSendFlow({ phone, type: flowType })
        .then((data) =>
          console.log(`[${new Date().toISOString()}] Flow succeeded:`, data)
        )
        .catch((err) =>
          console.error(`[${new Date().toISOString()}] Flow error:`, err)
        );
    });

    res.status(202).json({ message: "Webhook received, processing started" });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).send("Internal Server Error");
  }
}

// Start the application
startServer();
