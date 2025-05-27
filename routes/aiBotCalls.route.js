import express from "express";
import {
  aibotcallswebhook,
  BotCallAddedStatus,
  getAIcalls,
} from "../controller/aiBot.controller.js";

const router = express.Router();

router.post("/webhook", aibotcallswebhook);
router.get("/", getAIcalls);
router.put("/toggle-call-status", BotCallAddedStatus);

export default router;
