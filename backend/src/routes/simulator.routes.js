import { Router } from "express";
import * as simulatorController from "../controllers/simulator.controller.js";

const router = Router();

router.post("/fault", simulatorController.injectFault);
router.post("/repair", simulatorController.repairFault);
router.post("/kill-device", simulatorController.killDevice);
router.get("/network", simulatorController.getNetwork);

export default router;
