import express from "express";
import { ivrWebhook } from "../controller/ivr.controller.js";

const router = express.Router();

router.get("/record", ivrWebhook);

export default router;
