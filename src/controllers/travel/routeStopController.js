import { Route, RouteStop } from "../../models/travel/associations.js";
import {
  getRouteWhere,
  normalizeStops,
  userOwnsRoute,
} from "./travelShared.js";

export const addRouteStop = async (req, res) => {
  try {
    const route = await Route.findOne({
      where: getRouteWhere(req, { id: req.params.routeId }),
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    const { normalized, missingClients } = await normalizeStops(
      [req.body],
      req,
    );
    const [stopData] = normalized;

    if (!stopData) {
      return res.status(400).json({
        message: "El cliente es obligatorio",
        clients: missingClients,
      });
    }

    const stop = await RouteStop.create({
      ...stopData,
      routeId: route.id,
    });

    return res.status(201).json(stop);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error agregando parada a la ruta",
    });
  }
};

export const updateRouteStop = async (req, res) => {
  try {
    const stop = await RouteStop.findByPk(req.params.id, {
      include: [{ model: Route, as: "route" }],
    });

    if (!stop || !userOwnsRoute(req, stop.route)) {
      return res.status(404).json({
        message: "Parada no encontrada",
      });
    }

    const {
      visitNumber,
      position,
      plannedTime,
      addressSnapshot,
      notes,
      skippedReason,
      status,
      isVisited,
    } = req.body;

    await stop.update({
      visitNumber: visitNumber ?? stop.visitNumber,
      position: position ?? stop.position,
      plannedTime: plannedTime ?? stop.plannedTime,
      addressSnapshot: addressSnapshot ?? stop.addressSnapshot,
      notes: notes ?? stop.notes,
      skippedReason: skippedReason ?? stop.skippedReason,
      status: status ?? stop.status,
      isVisited: isVisited ?? stop.isVisited,
    });

    return res.json({
      message: "Parada actualizada correctamente",
      stop,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error actualizando la parada",
    });
  }
};
