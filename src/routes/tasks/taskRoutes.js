import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../../controllers/tasks/taskController.js";

const router = express.Router();

router.post("/tasks", authMiddleware, createTask);

router.get("/tasks", authMiddleware, getTasks);
router.get("/tasks/user/:userId", authMiddleware, getTaskById);

router.patch("/tasks/:id", authMiddleware, updateTask);

router.delete("/tasks/:id", authMiddleware, deleteTask);

export default router;

