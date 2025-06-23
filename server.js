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
    app.use("/ticket", verifyMiddlewareToken, ticketRoutes);
    app.use("/admin", verifyMiddlewareToken, adminRoutes);
    app.use("/aibot", aiBotsRoutes);
    app.use("/field-ticket", fieldTicketRoutes);
    app.use("/aibotData", aiBotsDataRoutes);
    app.use("/social-media", socialMediaRoutes);

    app.get("/", (req, res) => {
      res.send("Welcome to market dashboard");
    });

    // Existing tags API
    app.get("/tags", async (req, res) => {
      try {
        const tags = await User.distinct("tag", { tag: { $nin: [null, ""] } });
        res.json(tags.filter(Boolean));
      } catch (err) {
        console.error("Error fetching tags:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // NEW APIs for village, hobli, taluk, district
    app.get("/villages", async (req, res) => {
      try {
        const villages = await User.distinct("village", {
          village: { $nin: [null, ""] },
        });
        res.json(villages.filter(Boolean).sort());
      } catch (err) {
        console.error("Error fetching villages:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/hoblis", async (req, res) => {
      try {
        const hoblis = await User.distinct("hobli", {
          hobli: { $nin: [null, ""] },
        });
        res.json(hoblis.filter(Boolean).sort());
      } catch (err) {
        console.error("Error fetching hoblis:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/taluks", async (req, res) => {
      try {
        const taluks = await User.distinct("taluk", {
          taluk: { $nin: [null, ""] },
        });
        res.json(taluks.filter(Boolean).sort());
      } catch (err) {
        console.error("Error fetching taluks:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/districts", async (req, res) => {
      try {
        const districts = await User.distinct("district", {
          district: { $nin: [null, ""] },
        });
        res.json(districts.filter(Boolean).sort());
      } catch (err) {
        console.error("Error fetching districts:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Other existing routes (users, download-users, webhooks)
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
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
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
  taluk,
  district,
}) {
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
  }
}

startServer();
