import express from "express";
import { aibotcallswebhook } from "../controller/aiBot.controller.js";

const router = express.Router();

router.post("/webhook", aibotcallswebhook);

export default router;
