import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";
import userRoute from "./routes/userRoute.js";
import plivoRoute from "./routes/plivo.route.js";
import plivoReportRoute from "./routes/plivoReport.route.js";
import agentRoutes from "./routes/agent.route.js";
import ticketRoutes from "./routes/ticket.route.js";
import ivrRoute from "./routes/ivr.route.js";
import aiBotsRoutes from "./routes/aiBotCalls.route.js";
import { createUserAndSendFlow, sendUpdateFlow } from "./whatsapp.js";
import { format } from "fast-csv";
import { verifyMiddlewareToken } from "./middleware/auth.js";

dotenv.config();
const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    await connectDB();
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());

    app.use(userRoute);
    app.use(plivoRoute);
    app.use(plivoReportRoute);
    app.use("/ivr", ivrRoute);
    app.use("/agent", agentRoutes);
    app.use("/ticket", ticketRoutes);
    app.use("/aibot", verifyMiddlewareToken, aiBotsRoutes);

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
        const {
          page = 1,
          tag,
          consent,
          downloaded,
          date,
          search,
          category,
        } = req.query;
        const limit = 50;
        const skip = (page - 1) * limit;
        const query = buildUserQuery({
          tag,
          consent,
          downloaded,
          date,
          search,
          category,
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
        const { tag, consent, date, downloaded, category, columns } = req.query;

        // parse & sanitize pagination params (make from 1-based inclusive)
        let from = parseInt(req.query.from, 10);
        let to = parseInt(req.query.to, 10);
        if (isNaN(from) || from < 1) from = 1;
        if (isNaN(to) || to < from) to = from;

        const startIdx = from - 1; // zero-based skip
        const count = to - (from - 1); // inclusive limit: to - startIdx

        const query = buildUserQuery({
          tag,
          consent,
          downloaded,
          date,
          category,
        });
        const fields = selectCsvFields(columns);
        const filename = `users_${tag || "all"}_${
          category || "all"
        }_${Date.now()}.csv`;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        // build a cursor that skips startIdx and takes exactly `count` docs
        const cursor = User.find(query)
          .sort({ _id: 1 })
          .skip(startIdx)
          .limit(count)
          .lean()
          .cursor();

        const csvStream = format({ headers: fields, writeHeaders: true });
        csvStream.pipe(res).on("error", (err) => {
          console.error("CSV stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });

        cursor.on("data", (doc) => {
          const row = fields.reduce((acc, key) => {
            acc[key] = doc[key];
            return acc;
          }, {});
          csvStream.write(row);
        });

        cursor.on("end", () => csvStream.end());
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

    app.get("/webhook", handleWebhook);

    app.get("/update-webhook", handleUpdateWebhook);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Utilities and handlers

function buildUserQuery({ tag, consent, downloaded, date, search, category }) {
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

  if (category && category !== "all") {
    const categoryMap = {
      "Margin+Farmer": "Margin Farmer",
      "Small+Farmer": "Small Farmer",
      "Big+Farmer": "Big Farmer",
    };
    query.farmer_category = categoryMap[category] || category;
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
    "onboarded_date",
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

async function handleUpdateWebhook(req, res) {
  try {
    let { CallFrom: callFrom } = req.query;
    if (!callFrom) return res.status(400).send("Missing CallFrom");

    console.log("Received CallFrom:", callFrom);

    callFrom = callFrom.replace(/^0+/, "").trim().replace(/^"|"$/g, "");
    const phone = `91${callFrom}`;

    console.log("Sanitized phone number:", phone);

    setImmediate(() => {
      sendUpdateFlow({ phone })
        .then((data) =>
          console.log(`[${new Date().toISOString()}] Flow succeeded:`, data)
        )
        .catch((err) =>
          console.error(`[${new Date().toISOString()}] Flow error:`, err)
        );
    });
    res.status(202).json({ message: "Webhook received, processing started" });
  } catch (error) {
    console.error("Error in update webhook:", error);
    res.status(500).json({ error: "Internal Server Error" });
    ``;
  }
}

startServer();
