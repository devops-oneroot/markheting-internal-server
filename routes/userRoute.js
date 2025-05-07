import multer from "multer";

import { Router } from "express";
import {
  updateDatabase,
  importCsv,
  concentAdd,
  location,
  findNonOnboardedOrDownloadableUsers,
} from "../controller/userController.js";

const route = Router();
const upload = multer({ dest: "uploads/" });

// route.put("/consent", concentAdd);
route.put("/consent", upload.single("csv"), concentAdd);
route.post("/user-import", upload.single("csv"), importCsv);
route.get("/update-database", updateDatabase);
route.get("/location/:pincode", location);
route.get(
  "/non-onboard",
  upload.single("csv"),
  findNonOnboardedOrDownloadableUsers
);

export default route;
