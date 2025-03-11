import express from "express";
import connectDB from "./database/mongo.js";
import User from "./model/user.model.js";

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

server.route("/webhook").get((req, res) => {
  console.log(req.params);
  res.send("Webhook is working");
});
