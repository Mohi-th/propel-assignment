import { Router } from "express";
import * as scheduledOutageController from "../controllers/scheduledOutage.controller.js";

const router = Router();

router.get("/", scheduledOutageController.getAll);
router.post("/", scheduledOutageController.create);

export default router;
