import { Router } from "express";
import { concentAdd } from "../controller/userController.js";

const route = Router();

route.put("/consent", concentAdd);

export default route;
