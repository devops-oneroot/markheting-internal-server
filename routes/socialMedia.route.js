import express from "express";
import { facebookbotWebhook } from "../controller/socialMedia.controller.js";

const router = express.Router();

router.post("/facebook-bot/webhook/:label", facebookbotWebhook);

export default router;
