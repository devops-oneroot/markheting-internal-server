import express from "express";
import { createTicket } from "../controller/fieldTicket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/", (req, res) => {
  res.send("sup");
});

export default router;
