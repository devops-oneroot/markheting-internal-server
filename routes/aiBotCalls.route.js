import express from "express";
import {
  aibotcallswebhook,
  BotCallAddedStatus,
  getAIcalls,
  sortByTrees,
  getAllNumbers,
  downloadAIcallsBatch,
} from "../controller/aiBot.controller.js";

const router = express.Router();

router.post("/webhook", aibotcallswebhook);
router.get("/", getAIcalls);
router.get("/download", downloadAIcallsBatch); // Assuming this is for downloading AI calls
router.put("/toggle-call-status", BotCallAddedStatus);
router.get("/sort-by-trees", sortByTrees);
router.get("/get-numbers", getAllNumbers);

export default router;
 