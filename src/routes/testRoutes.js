import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/admin",
  authMiddleware,
  roleMiddleware(["admin"]),
  (req, res) => {
    res.json({ message: "Ruta solo para admin" });
  }
);

router.get(
  "/seller",
  authMiddleware,
  roleMiddleware(["admin","seller"]),
  (req, res) => {
    res.json({ message: "Ruta para vendedores" });
  }
);

export default router;