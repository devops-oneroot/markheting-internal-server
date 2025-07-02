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
import adminRoutes from "./routes/admin.route.js";
import aiBotsRoutes from "./routes/aiBotCalls.route.js";
import fieldTicketRoutes from "./routes/fieldTicket.route.js";
import aiBotsDataRoutes from "./routes/aibotsData.route.js";
import socialMediaRoutes from "./routes/socialMedia.route.js";
import { createUserAndSendFlow, sendUpdateFlow } from "./whatsapp/whatsapp.js";
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
    // Routes
    app.use(userRoute);
    app.use(plivoRoute);
    app.use(plivoReportRoute);
    app.use("/ivr", ivrRoute);
    app.use("/agent", agentRoutes);
    app.use("/ticket", verifyMiddlewareToken, ticketRoutes);
    app.use("/admin", verifyMiddlewareToken, adminRoutes);
    app.use("/aibot", aiBotsRoutes);
    app.use("/field-ticket", fieldTicketRoutes);
    app.use("/aibotData", aiBotsDataRoutes);
    app.use("/social-media", socialMediaRoutes);
    // Base route
    app.get("/", (req, res) => {
      res.send("Welcome to market dashboard");
    });

    // === TAG FILTERING FOR MULTIPLE TAGS ===
    app.get("/tags", async (req, res) => {
      try {
        // Only fetch the distinct tag values directly from MongoDB
        const tags = await User.distinct("tag", {
          tag: { $exists: true, $ne: null },
        });

        // Flatten and clean up if `tag` is stored as arrays
        const flatTags = tags
          .flatMap((tag) => (Array.isArray(tag) ? tag : [tag]))
          .map((tag) => tag.trim())
          .filter((tag) => tag !== "");

        // Remove duplicates
        const uniqueTags = [...new Set(flatTags)];

        res.json(uniqueTags);
      } catch (err) {
        console.error("Error fetching tags:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // === VILLAGE, HOBLI, TALUK, DISTRICT ===
    const distinctFields = ["village", "hobli", "taluk", "district"];
    distinctFields.forEach((field) => {
      app.get(`/${field}s`, async (req, res) => {
        try {
          const values = await User.distinct(field, {
            [field]: { $nin: [null, ""] },
          });
          res.json(values.filter(Boolean).sort());
        } catch (err) {
          console.error(`Error fetching ${field}s:`, err.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });
    });
    // === USERS ===
    app.get("/users", async (req, res) => {
      try {
        const {
          page = 1,
          tag,
          consent,
          downloaded,
          identity,
          date,
          search,
          category,
          hobli,
          village,
          taluk,
          district,
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
          identity,
          hobli,
          village,
          taluk,
          district,
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
    // === DOWNLOAD USERS CSV ===
    app.get("/download-users", async (req, res) => {
      try {
        const {
          tag,
          consent,
          date,
          downloaded,
          category,
          columns,
          hobli,
          village,
          taluk,
          district,
          from,
          to,
        } = req.query;
        let startIdx = Math.max(parseInt(from, 10) - 1 || 0, 0);
        let count = Math.max(parseInt(to, 10) - startIdx || 50, 1);
        const query = buildUserQuery({
          tag,
          consent,
          downloaded,
          date,
          category,
          hobli,
          village,
          taluk,
          district,
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
      console.log(
        `:white_check_mark: Server running on http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error(":x: Failed to start server:", err);
    process.exit(1);
  }
}
function buildUserQuery({
  tag,
  consent,
  downloaded,
  date,
  search,
  category,
  hobli,
  village,
  identity,
  taluk,
  district,
}) {
  const query = {};

  if (tag) {
    const tagsArray = tag
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagsArray.length > 0) {
      query.tag = { $in: tagsArray };
    }
  }

  if (identity) query.identity = identity;

  if (consent)
    query.consent = consent === "yes" ? "yes" : { $in: ["", null, "no"] };

  if (downloaded === "yes") query.downloaded = true;
  else if (downloaded === "no") query.downloaded = false;
  else if (downloaded === "null") query.downloaded = null;

  // ✅ Proper date filtering using createdAt
  if (date) {
    const day = new Date(date);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    query.createdAt = {
      $gte: day,
      $lt: nextDay,
    };
  }

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

  if (hobli) query.hobli = { $regex: hobli, $options: "i" };
  if (village) query.village = { $regex: village, $options: "i" };
  if (taluk) query.taluk = { $regex: taluk, $options: "i" };
  if (district) query.district = { $regex: district, $options: "i" };

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
          console.log(`[${new Date().toISOString()}] Flow success`, data)
        )
        .catch((err) =>
          console.error(`[${new Date().toISOString()}] Flow error`, err)
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
    callFrom = callFrom.replace(/^0+/, "").trim().replace(/^"|"$/g, "");
    const phone = `91${callFrom}`;
    setImmediate(() => {
      sendUpdateFlow({ phone })
        .then((data) =>
          console.log(`[${new Date().toISOString()}] Update flow success`, data)
        )
        .catch((err) =>
          console.error(`[${new Date().toISOString()}] Update flow error`, err)
        );
    });
    res.status(202).json({ message: "Webhook received, processing started" });
  } catch (error) {
    console.error("Error in update webhook:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

startServer();
