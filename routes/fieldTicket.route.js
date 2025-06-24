import express from "express";
import {
  createTicket,
  getOpenTicketsByFieldGuy,
  updateTicketStatus,
} from "../controller/fieldTicket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/:fielduserId", getOpenTicketsByFieldGuy);
router.put("/", updateTicketStatus);

export default router;
