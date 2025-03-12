import express from "express";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";
import sendWhatsAppTemplateMessage from "./whatsapp.js";
import cluster from "cluster";
import os from "os";

// Master process: Fork workers based on CPU cores
if (cluster.isMaster) {
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
  // Worker process: Set up Express server and connect to DB
  connectDB()
    .then(() => {
      const server = express();

      // Middleware
      server.use(express.json());
      server.use(express.urlencoded({ extended: true }));

      // Routes
      server.get("/", (req, res) => {
        res.send("Welcome to market dashboard");
      });

      server.route("/users").get(async (req, res) => {
        try {
          const users = await User.find();
          res.json(users);
        } catch (error) {
          console.error("Error fetching users:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      server.route("/users").post(async (req, res) => {
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

      server.get("/webhook", (req, res) => {
        try {
          let callFrom = req.query.CallFrom;
          if (!callFrom) {
            return res.status(400).send("Missing CallFrom parameter");
          }
          if (callFrom.startsWith("0")) {
            callFrom = callFrom.substring(1);
          }
          const phoneNumber = "91" + callFrom;

          // Decouple the asynchronous task from the response cycle
          setImmediate(() => {
            sendWhatsAppTemplateMessage({
              to: phoneNumber,
              templateName: "voice_broadcast_farmer_app_install",
              languageCode: "kn",
              imageLink: "https://i.imgur.com/XLYYiUz.jpeg",
            })
              .then((responseData) => {
                console.log(
                  `[${new Date().toISOString()}] WhatsApp message processed:`,
                  responseData
                );
              })
              .catch((error) => {
                console.error(
                  `[${new Date().toISOString()}] Error processing WhatsApp message:`,
                  error
                );
              });
          });

          // Immediately respond to the client
          res.status(202).send({
            message: "Webhook processed - WhatsApp message sending initiated",
          });
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error in webhook:`,
            error
          );
          res.status(500).send("Internal Server Error");
        }
      });

      // Start server
      const PORT = process.env.PORT || 3000;
      server.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error(`Worker ${process.pid} failed to connect to MongoDB:`, err);
      // Optionally: process.exit(1) to terminate worker and let master restart
    });
}
