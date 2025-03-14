import multer from "multer";

import { Router } from "express";
import { concentAdd } from "../controller/userController.js";

const route = Router();
const upload = multer({ dest: "uploads/" });

// route.put("/consent", concentAdd);
route.post("/upload", upload.single("csv"), concentAdd);

export default route;
