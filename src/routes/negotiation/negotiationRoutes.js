import express from "express";
import {
  createNegotiation,
  updateNegotiation,
  getNegotiationsByClient,
  getAllNegotiations
} from "../../controllers/negotation/negotiationController.js";
import { uploadQuote } from "../../middleware/upload.js";


const router = express.Router();

router.post("/negotiations", uploadQuote.single("pdf"), createNegotiation);
router.put("/negotiations/:id", uploadQuote.single("pdf"), updateNegotiation);
router.get("/negotiations/client/:clientId", getNegotiationsByClient);

// opcional
router.get("/negotiations", getAllNegotiations);

export default router;