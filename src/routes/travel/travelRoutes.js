import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import {
  addRouteStop,
  createRoute,
  createVisit,
  getMyRoutes,
  getRouteById,
  getRoutes,
  getTodayRoute,
  matchRouteTrack,
  updateRoute,
  updateRouteStop,
  updateVisit,
} from "../../controllers/travel/travelController.js";

const router = express.Router();

router.get("/routes", authMiddleware, getRoutes);
router.get("/routes/mine", authMiddleware, getMyRoutes);
router.get("/routes/today", authMiddleware, getTodayRoute);
router.get("/routes/:id", authMiddleware, getRouteById);
router.post("/routes", authMiddleware, createRoute);
router.patch("/routes/:id", authMiddleware, updateRoute);
router.post("/routes/:id/match-track", authMiddleware, matchRouteTrack);

router.post("/routes/:routeId/stops", authMiddleware, addRouteStop);
router.patch("/stops/:id", authMiddleware, updateRouteStop);

router.post("/stops/:routeStopId/visits", authMiddleware, createVisit);
router.patch("/visits/:id", authMiddleware, updateVisit);

export default router;
