import express from "express";
import {
  login,
  register,
  getUsers,
  updateUser,
  logout
} from "../../controllers/auth/authController.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { roleMiddleware } from "../../middleware/roleMiddleware.js";

const router = express.Router();


// simplificar las rutas para que si o si solicite el authMiddleware 
// y el roleMiddleware, esto con el fin de que esten logueadas las rutas

// router.use(authMiddleware)
// router.use(roleMiddleware(["admin"]))

router.post("/login", login);
router.post("/register", authMiddleware, roleMiddleware(["admin"]), register);
router.get("/users", authMiddleware, roleMiddleware(["admin"]), getUsers);
router.put("/users/:id", authMiddleware, roleMiddleware(["admin"]), updateUser);
router.post("/logout", authMiddleware, logout);
export default router;
