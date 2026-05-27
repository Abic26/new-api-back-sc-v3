import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";

import {
  createMailData,
  getMailDataByUser,
  getMailDataById,
  updateMailData,
  deleteMailData,
} from "../../controllers/sendMail/sendMailController.js";

const router = express.Router();

// Crear
router.post("/", authMiddleware, createMailData);

// Obtener por userId 👈 IMPORTANTE
router.get("/user/:userId", authMiddleware, getMailDataByUser);

// Obtener por id
router.get("/:id", authMiddleware, getMailDataById);

// Actualizar
router.put("/:id", authMiddleware, updateMailData);

// Eliminar
router.delete("/:id", authMiddleware, deleteMailData);

export default router;
