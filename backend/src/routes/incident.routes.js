import { Router } from "express";
import * as incidentController from "../controllers/incident.controller.js";

const router = Router();

router.get("/", incidentController.getAll);
router.get("/:id", incidentController.getById);
router.patch("/:id", incidentController.updateStatus);

export default router;
