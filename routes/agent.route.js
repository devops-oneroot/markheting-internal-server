import express from "express";
import {
  createAgent,
  getAgentById,
  loginAgent,
  resetPassword,
  verifyToken,
} from "../controller/agent.controller.js";

const router = express.Router();

router.post("/", createAgent);
router.put("/password", resetPassword);
router.post("/login", loginAgent);
router.get("/:id", getAgentById);
router.get("/token/:token", verifyToken);

export default router;
