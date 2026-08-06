import { Router } from "express";
import * as poleController from "../controllers/pole.controller.js";

const router = Router();

router.get("/", poleController.getAll);
router.get("/:id", poleController.getById);

export default router;
