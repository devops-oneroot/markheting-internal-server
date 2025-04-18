import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";
import { createUserAndSendFlow } from "./whatsapp.js";
import userRoute from "./routes/userRoute.js";
import cluster from "cluster";
import os from "os";
import cors from "cors";
import { Parser } from "json2csv";
import plivoRoute from "./routes/plivo.route.js";
// import locationRoute from "./routes/locationRoute.js";

dotenv.config();

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Master process starting ${numCPUs} workers`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died; restarting...`);
    cluster.fork();
  });
} else {
  connectDB()
    .then(() => {
      const server = express();
      const PORT = process.env.PORT || 3005;
      server.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`);
      });

      server.use(express.json());
      server.use(express.urlencoded({ extended: true }));
      server.use(cors());
      server.use(userRoute);
      server.use(plivoRoute);
      // server.use(locationRoute);

      // PUT: Update User
      server.put("/users/:id", async (req, res) => {
        try {
          const { id } = req.params;
          const {
            name,
            village,
            taluk,
            district,
            number,
            identity,
            tags, // Changed to match frontend
            consent,
            consent_date,
            downloaded,
            downloaded_date,
          } = req.body;

          const user = await User.findById(id);
          if (!user) return res.status(404).json({ error: "User not found" });

          // Update only if values are explicitly provided in the payload
          user.name = name ?? user.name;
          user.village = village ?? user.village;
          user.taluk = taluk ?? user.taluk;
          user.district = district ?? user.district;
          user.number = number ?? user.number;
          user.identity = identity ?? user.identity;
          user.tags = tags ?? user.tags; // Changed to tags
          user.consent = consent ?? user.consent;
          user.consent_date = consent_date ?? user.consent_date;
          user.downloaded_date = downloaded_date ?? user.downloaded_date;

          // Explicitly handle downloaded to preserve null, true, or false
          if ("downloaded" in req.body) {
            user.downloaded = downloaded; // Allows null, true, or false
          }

          const updatedUser = await user.save();
          res.json(updatedUser);
        } catch (error) {
          console.error("Error updating user:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      // Root route
      server.get("/", (req, res) => {
        res.send("Welcome to market dashboard");
      });

      // Fetch distinct tags
      server.get("/tags", async (req, res) => {
        try {
          const tags = await User.distinct("tag", {
            tag: { $nin: [null, ""] },
          }); // Changed to tag

          res.json(tags.filter(Boolean));
        } catch (error) {
          console.error("Error fetching tags:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      // Fetch users with filters
      server.get("/users", async (req, res) => {
        try {
          const {
            page = 1,
            tag,
            consent,
            downloaded,
            date,
            search,
          } = req.query;
          const limit = 50;
          const skip = (page - 1) * limit;

          const query = {};
          // Fix: filter by tag
          if (tag) query.tag = tag; // Changed to tags
          // Consent filter
          if (consent) {
            query.consent =
              consent === "yes" ? "yes" : { $in: ["", null, "no"] };
          }
          // Downloaded filter

          if (downloaded === "yes") query.downloaded = true;
          else if (downloaded === "no") query.downloaded = false;
          else if (downloaded === "null") query.downloaded = null;

          // Date filter corrected for YYYY-MM-DD input
          if (date) {
            const [year, month, day] = date.split("-"); // '2025-04-09'
            const formattedDate = `${year}-${month}-${day}`; // Ensure correct format
            query.consent_date = { $regex: `^${formattedDate}` };
          }

          if (search) {
            query.$or = [
              { name: { $regex: search, $options: "i" } },
              { number: { $regex: search, $options: "i" } },
            ];
          }

          const users = await User.find(query).skip(skip).limit(limit);
          const totalUsers = await User.countDocuments(query);
          const totalPages = Math.ceil(totalUsers / limit);

          res.json({
            users,
            totalPages,
            totalUsers,
          });
        } catch (error) {
          console.error("Error fetching users:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      // Download CSV of filtered users
      server.get("/download-users", async (req, res) => {
        try {
          const { tag, consent, date, downloaded } = req.query;
          let query = {};
          if (tag) query.tag = tag; // Changed to tags
          if (consent) query.consent = consent === "yes" ? "yes" : "";
          if (date) query.consent_date = new Date(date);
          if (downloaded === "yes") query.downloaded = true;
          else if (downloaded === "no") query.downloaded = false;
          else if (downloaded === "null") query.downloaded = null;

          const users = await User.find(query);
          const fields = [
            "name",
            "number",
            "identity",
            "tag", // Changed to tags
            "consent",
            "consent_date",
            "downloaded",
            "downloaded_date",
            "village",
            "taluk",
            "district",
            "createdAt",
            "updatedAt",
          ];
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(users);

          res.header("Content-Type", "text/csv");
          res.attachment(`users_${tag || "all"}_${Date.now()}.csv`);
          res.send(csv);
        } catch (error) {
          console.error("Error generating CSV:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      // POST: Add a new user
      server.post("/users", async (req, res) => {
        try {
          const { name, village, taluk, district, identity, number } = req.body;
          const newUser = await User.create({
            name,
            village,
            taluk,
            district,
            identity,
            number,
          });
          res.json(newUser);
        } catch (error) {
          console.error("Error creating user:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      // Webhook for WhatsApp flow
      server.get("/webhook", (req, res) => {
        try {
          let callFrom = req.query.CallFrom;
          console.log("CallFrom:", callFrom);
          if (!callFrom) return res.status(400).send("Missing CallFrom");

          if (callFrom.startsWith("0")) {
            console.log("Removing leading 0");
            callFrom = callFrom.substring(1);
          }
          const phoneNumber = "91" + callFrom;

          setImmediate(() => {
            createUserAndSendFlow({ phone: phoneNumber, type: "broadcast" })
              .then((responseData) => {
                console.log(
                  `[${new Date().toISOString()}] WhatsApp message processed:`,
                  responseData
                );
              })
              .catch((error) => {
                console.error(
                  `[${new Date().toISOString()}] WhatsApp error:`,
                  error
                );
              });
          });

          res.status(202).send({
            message: "Webhook processed - WhatsApp message sending initiated",
          });
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Webhook error:`, error);
          res.status(500).send("Internal Server Error");
        }
      });

      //Webhook for new user download link
      server.get("/webhook", (req, res) => {
        try {
          let callFrom = req.query.CallFrom;
          console.log("CallFrom:", callFrom);
          if (!callFrom) return res.status(400).send("Missing CallFrom");

          if (callFrom.startsWith("0")) {
            console.log("Removing leading 0");
            callFrom = callFrom.substring(1);
          }
          const phoneNumber = "91" + callFrom;

          setImmediate(() => {
            createUserAndSendFlow({ phone: phoneNumber, type: "call link" })
              .then((responseData) => {
                console.log(
                  `[${new Date().toISOString()}] WhatsApp message processed:`,
                  responseData
                );
              })
              .catch((error) => {
                console.error(
                  `[${new Date().toISOString()}] WhatsApp error:`,
                  error
                );
              });
          });

          res.status(202).send({
            message: "Webhook processed - WhatsApp message sending initiated",
          });
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Webhook error:`, error);
          res.status(500).send("Internal Server Error");
        }
      });

    })
    .catch((err) => {
      console.error(`Worker ${process.pid} failed to connect to MongoDB:`, err);
    });
}
