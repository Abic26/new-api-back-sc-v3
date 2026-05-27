import express from "express";
import {
  createHistory,
  getHistoryByNegotiation,
} from "../../controllers/negotation/historyController.js";

const router = express.Router();

router.post("/history", createHistory);

router.get("/history/:id", getHistoryByNegotiation);

export default router;