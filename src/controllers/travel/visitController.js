import { Op } from "sequelize";
import { Route, RouteStop, Visit } from "../../models/travel/associations.js";
import { userOwnsRoute } from "./travelShared.js";

export const createVisit = async (req, res) => {
  try {
    const stop = await RouteStop.findByPk(req.params.routeStopId, {
      include: [{ model: Route, as: "route" }],
    });

    if (!stop || !userOwnsRoute(req, stop.route)) {
      return res.status(404).json({
        message: "Parada no encontrada",
      });
    }

    const {
      startTime,
      endTime,
      status,
      summary,
      gpsTrack,
      options,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    } = req.body;

    const existingVisit = await Visit.findOne({
      where: {
        routeStopId: stop.id,
        status: {
          [Op.in]: ["pending", "in_progress", "completed"],
        },
      },
      order: [["createdAt", "DESC"]],
    });

    if (existingVisit?.status === "completed") {
      return res.status(409).json({
        message: "Esta visita ya fue finalizada",
        visit: existingVisit,
      });
    }

    if (existingVisit) {
      await existingVisit.update({
        startTime: startTime ?? existingVisit.startTime,
        endTime: endTime ?? existingVisit.endTime,
        status: status ?? existingVisit.status,
        summary: summary ?? existingVisit.summary,
        gpsTrack: gpsTrack ?? existingVisit.gpsTrack,
        options: options ?? existingVisit.options,
        latitudeStart: latitudeStart ?? existingVisit.latitudeStart,
        longitudeStart: longitudeStart ?? existingVisit.longitudeStart,
        latitudeEnd: latitudeEnd ?? existingVisit.latitudeEnd,
        longitudeEnd: longitudeEnd ?? existingVisit.longitudeEnd,
      });

      if (status === "in_progress") {
        await stop.update({ status: "in_progress" });
      }

      return res.status(200).json(existingVisit);
    }

    const visit = await Visit.create({
      routeStopId: stop.id,
      startTime,
      endTime,
      status,
      summary,
      gpsTrack,
      options,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    });

    if (status === "in_progress") {
      await stop.update({ status: "in_progress" });
    }

    if (status === "completed") {
      await stop.update({ status: "done", isVisited: true });
    }

    return res.status(201).json(visit);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error creando visita",
    });
  }
};

export const updateVisit = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id, {
      include: [
        {
          model: RouteStop,
          as: "routeStop",
          include: [{ model: Route, as: "route" }],
        },
      ],
    });

    if (!visit || !userOwnsRoute(req, visit.routeStop.route)) {
      return res.status(404).json({
        message: "Visita no encontrada",
      });
    }

    const {
      startTime,
      endTime,
      status,
      summary,
      gpsTrack,
      options,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    } = req.body;

    if (gpsTrack !== undefined) {
      return res.status(400).json({
        message: "Los puntos GPS se guardan por lotes en la ruta",
      });
    }

    await visit.update({
      startTime: startTime ?? visit.startTime,
      endTime: endTime ?? visit.endTime,
      status: status ?? visit.status,
      summary: summary ?? visit.summary,
      options: options ?? visit.options,
      latitudeStart: latitudeStart ?? visit.latitudeStart,
      longitudeStart: longitudeStart ?? visit.longitudeStart,
      latitudeEnd: latitudeEnd ?? visit.latitudeEnd,
      longitudeEnd: longitudeEnd ?? visit.longitudeEnd,
    });

    if (status === "completed") {
      await visit.routeStop.update({ status: "done", isVisited: true });
    }

    return res.json({
      message: "Visita actualizada correctamente",
      visit,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error actualizando la visita",
    });
  }
};
