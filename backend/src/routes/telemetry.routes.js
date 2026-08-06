import { Router } from "express";
import * as telemetryController from "../controllers/telemetry.controller.js";

const router = Router();

router.post("/", telemetryController.ingestTelemetry);
router.post("/batch", telemetryController.ingestTelemetryBatch);

export default router;
