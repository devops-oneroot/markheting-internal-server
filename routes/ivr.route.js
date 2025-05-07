import express from "express";
import { ivrRecords, ivrWebhook } from "../controller/ivr.controller.js";

const router = express.Router();

router.get("/record", ivrWebhook);
router.get("", ivrRecords)

export default router;
