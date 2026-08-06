import { Router } from "express";
import * as poleController from "../controllers/pole.controller.js";

const router = Router();

router.get("/", poleController.getFeeders);

export default router;
