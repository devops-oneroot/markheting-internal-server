import express from "express";
import { Router } from "express";

import {
  plivoAnswer,
  plivoAnswerHandle,
  plivoDaysHandle,
  plivoHangup,
} from "../controller/plivo.controller.js";

const route = Router();

route.post("/plivo/answer", plivoAnswer);
route.post("/plivo/answer-handle", plivoAnswerHandle);
route.post("/plivo/days-handle", plivoDaysHandle);
route.post("/plivo/hangup", plivoHangup);
route.get("/plivo", (req, res) => {
  res.send("Plivo Up");
});

export default route;
