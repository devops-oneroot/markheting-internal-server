import express from "express";
import {
  facebookbotWebhook,
  contactCreatedWebhook,
} from "../controller/socialMedia.controller.js";

const router = express.Router();

router.post("/facebook-bot/webhook/:label", facebookbotWebhook);
router.post("/contact-created/webhook/:label", contactCreatedWebhook);

export default router;
