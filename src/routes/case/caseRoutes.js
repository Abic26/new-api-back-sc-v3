import express from "express";

import {
  createFollowUp,
  createQuote,
  getFollowUpsByClient,
  getQuotesByClient,
  updateFollowUp,
  getPendingFollowUpsGrouped,
} from "../../controllers/case/caseController.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { uploadQuote } from "../../middleware/upload.js";

const router = express.Router();

router.post("/followups", createFollowUp);
router.post("/quotes", uploadQuote.single("pdf"), createQuote);

router.get("/clients/:clientId/followups", getFollowUpsByClient);
router.get("/clients/:clientId/quotes", getQuotesByClient);

router.put("/followup/:id", updateFollowUp);
router.get("/followup/all", authMiddleware, getPendingFollowUpsGrouped);

export default router;
