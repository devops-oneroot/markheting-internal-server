import express from "express";
import {
  aibotcallswebhook,
  getAIcalls,
} from "../controller/aiBot.controller.js";

const router = express.Router();

router.post("/webhook", aibotcallswebhook);
router.get("/", getAIcalls);

export default router;
