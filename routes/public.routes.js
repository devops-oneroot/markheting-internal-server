import express from "express";
import { handleWebhook } from "../controller/ticket.controller.js";

const publicRouter = express.Router();

publicRouter.post("/ticket/webhook", handleWebhook);

export default publicRouter;
