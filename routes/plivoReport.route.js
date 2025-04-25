import { Router } from "express";
import {
  getDailyRTHReport,
  getPreRTHReport,
} from "../controller/plivoReport.controller.js";

const route = Router();

route.get("/plivo-report/daily", getDailyRTHReport);
route.get("/plivo-report/pre_RTH", getPreRTHReport);

export default route;
