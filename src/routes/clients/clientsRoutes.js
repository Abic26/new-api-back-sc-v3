import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { createClient } from "../../controllers/clients/createClient.js";
import { getClients, getClientsWalletStatus } from "../../controllers/clients/getClients.js";
import { updateClient } from "../../controllers/clients/updateClient.js";

const router = express.Router();

router.post("/", authMiddleware, createClient);
router.get("/", authMiddleware, getClients);
router.get("/walletstatus", authMiddleware, getClientsWalletStatus);
router.put("/:id", authMiddleware, updateClient);

export default router;