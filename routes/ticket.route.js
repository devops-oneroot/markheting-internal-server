import express from "express";
import {
  createTicket,
  deleteTickets,
  getTicketsOpenedById,
  getUserAssignedTicketsById,
  updateTicketById,
  getUserById,
} from "../controller/ticket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.get("/get-opened-tickets", getTicketsOpenedById);
router.put("/", updateTicketById);
router.get("/user/:userId", getUserAssignedTicketsById);
router.delete("/", deleteTickets);
router.get("/users/:userId", getUserById);


export default router;
