import express from "express";
import {
  createTicket,
  deleteTickets,
  getTicketById,
  getTicketsOpened,
  getUserAssignedTicketsById,
  multiTicketUpdate,
  updateTicketById,
} from "../controller/ticket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/get-opened-tickets", getTicketsOpened);
router.put("/", updateTicketById);
router.get("/:id", getTicketById);
router.put("/multiple", multiTicketUpdate);
router.get("/user/:userId", getUserAssignedTicketsById);
router.delete("/", deleteTickets);

export default router;
