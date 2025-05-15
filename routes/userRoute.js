import multer from "multer";

import { Router } from "express";
import {
  updateDatabase,
  importCsv,
  concentAdd,
  location,
  findNonOnboardedOrDownloadableUsers,
  sendMessageToNewUsers,
  getRTHFarmersNumberCSV,
} from "../controller/userController.js";

const route = Router();
const upload = multer({ dest: "uploads/" });

// route.put("/consent", concentAdd);
route.put("/consent", upload.single("csv"), concentAdd);
route.post("/user-import", upload.single("csv"), importCsv);
route.get("/update-database", updateDatabase);
route.get("/location/:pincode", location);
route.post(
  "/non-onboard",
  upload.single("csv"),
  findNonOnboardedOrDownloadableUsers
);

route.post(
  "/new-users-update-wsmessage",
  upload.single("csv"),
  sendMessageToNewUsers
);

route.get("/get-rth-farmers-api", getRTHFarmersNumberCSV);

export default route;
