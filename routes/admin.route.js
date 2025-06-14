import express from "express";
import {
  adminGetAllAgents,
  getTicketsByAgentId,
} from "../controller/admin.controller.js";

const router = express.Router();

router.get("/get-all-agents", adminGetAllAgents);
router.get("/tickets/:id", getTicketsByAgentId);

export default router;
