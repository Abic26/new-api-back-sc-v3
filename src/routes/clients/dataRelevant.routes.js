import { Router } from "express";
import {
  getDataRelevantByClient,
  createDataRelevant,
  updateDataRelevant,
  deleteDataRelevant,
} from "../../controllers/clients/dataRelevant.controller.js";

const router = Router();

router.get("/client/:idClient", getDataRelevantByClient);
router.post("/", createDataRelevant);
router.put("/:id", updateDataRelevant);
router.delete("/:id", deleteDataRelevant);

export default router;