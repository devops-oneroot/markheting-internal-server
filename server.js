import express from "express";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";
import sendWhatsAppTemplateMessage from "./whatsapp.js";

const server = express();

connectDB()
  .then(() => {
    server.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });

server.get("/", (req, res) => {
  res.send("Welcome to market dashboard");
});

server.use(express.json());
server.use(express.urlencoded({ extended: true }));

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

server.get("/webhook", async (req, res) => {
  try {
    // Extract the phone number from req.query.CallFrom
    let callFrom = req.query.CallFrom;
    if (!callFrom) {
      res.status(400).send("Missing CallFrom parameter");
      return;
    }

    // Remove the first digit if it's "0" and prepend "91"
    if (callFrom.startsWith("0")) {
      callFrom = callFrom.substring(1);
    }
    const phoneNumber = "91" + callFrom;

    // Call the WhatsApp messaging function with the required template parameters
    const responseData = await sendWhatsAppTemplateMessage({
      to: phoneNumber,
      templateName: "hello_world",
    });

    res.status(200).send({
      message: "Webhook processed",
      response: responseData,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in webhook:`, error);
    res.status(500).send("Internal Server Error");
  }
});
