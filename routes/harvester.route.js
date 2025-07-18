import express from "express";
import {
  createHarvester,
  getAllHarvesters,
  getHarvesterById,
  updateHarvester,
  deleteHarvester,
} from "../controller/harvester.Controller.js";
import upload from "../middleware/multer.js";

const router = express.Router();

router.post(
  "/",
  upload.fields([
    { name: "aadhaar_card", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  createHarvester
);

router.get("/", getAllHarvesters);

router.get("/:id", getHarvesterById); // Ensure this route exists

router.put(
  "/:id",
  upload.fields([
    { name: "aadhaar_card", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  updateHarvester
);

router.delete("/:id", deleteHarvester);

export default router;
