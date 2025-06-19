import express from "express";
import {

  userbynumber,
  createUser,
   getUser,
} from "../controller/aiBotData.controller.js";

const router = express.Router();



router.get("/get-userbynumber",userbynumber)
router.post("/createUser",createUser)
router.get("/getUser",getUser)


export default router;
 