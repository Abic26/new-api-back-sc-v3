import { Router } from "express";
import { getWalletByClientId, getWalletByClientIdAll, getWalletByClientIdAllWallet } from "../../controllers/wallet/getWallet.js";
import { createWallet } from "../../controllers/wallet/createWallet.js";
import { updateWallet } from "../../controllers/wallet/updateWallet.js";


const router = Router();

router.get("/:clientId", getWalletByClientId);
router.get("/all/:clientId", getWalletByClientIdAll);
router.get("/allwallet/:clientId", getWalletByClientIdAllWallet);
router.post("/", createWallet);
router.patch("/:id", updateWallet);

export default router;
