import express from "express";
import {
  createTicket,
  getTicketsOpenedById,
  getUserAssignedTicketsById,
  updateTicketById,
} from "../controller/ticket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/get-opened-tickets/:id", getTicketsOpenedById);
router.put("/", updateTicketById);
router.get("/user/:userId", getUserAssignedTicketsById);

export default router;
