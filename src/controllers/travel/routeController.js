import { Route, RouteGpsPoint, RouteStop } from "../../models/travel/associations.js";
import {
  applyDateOnlyFilter,
  getAdminRouteWhere,
  getRouteWhere,
  getTodayInBogota,
  normalizeStops,
  routeInclude,
  routeIncludeWithGpsPoints,
  routeIncludeWithTrackMatches,
  routeListAttributes,
  routeListInclude,
  routeOrder,
  serializeRouteWithTrackMatches,
} from "./travelShared.js";

export const createRoute = async (req, res) => {
  try {
    const {
      date,
      status,
      stops = [],
      startTime,
      gpsTrack,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    } = req.body;
    const routeAdvisorId = req.user.id;

    if (!date) {
      return res.status(400).json({
        message: "La fecha de la ruta es obligatoria",
      });
    }

    const existingRoute = await Route.findOne({
      where: {
        date,
        advisorId: routeAdvisorId,
      },
    });

    if (existingRoute) {
      return res.status(409).json({
        message: "Ya existe una ruta para este asesor en esta fecha",
        routeId: existingRoute.id,
      });
    }

    const route = await Route.create({
      date,
      advisorId: routeAdvisorId,
      status,
      startTime,
      gpsTrack,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    });

    if (Array.isArray(stops) && stops.length > 0) {
      const { normalized, missingClients } = await normalizeStops(stops, req);

      if (missingClients.length > 0) {
        await route.destroy();

        return res.status(400).json({
          message: "No se encontraron algunos clientes por nombre",
          clients: missingClients,
        });
      }

      const routeStops = normalized.map((stop) => ({
        ...stop,
        routeId: route.id,
      }));

      await RouteStop.bulkCreate(routeStops);
    }

    const routeCreated = await Route.findByPk(route.id, {
      include: routeInclude,
      order: routeOrder,
    });

    return res.status(201).json(routeCreated);
  } catch (error) {
    console.error(error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Ya existe una ruta para este asesor en esta fecha",
      });
    }

    return res.status(500).json({
      message: "Error creando la ruta",
    });
  }
};

export const getRoutes = async (req, res) => {
  try {
    const { date, advisorId, detail } = req.query;
    const filters = {};
    const includeFullDetail = detail === "full";
    const includeGpsPoints = req.query.includeGpsPoints === "true";

    if (!applyDateOnlyFilter(filters, date)) {
      return res.status(400).json({
        message: "Formato de fecha invalido. Usa YYYY-MM-DD o DD/MM/YYYY.",
      });
    }

    if (req.user.role === "admin" && advisorId) filters.advisorId = advisorId;

    await RouteGpsPoint.sync();

    const routes = await Route.findAll({
      where: getAdminRouteWhere(req, filters),
      attributes: includeFullDetail ? undefined : routeListAttributes,
      include: includeFullDetail
        ? includeGpsPoints
          ? routeIncludeWithGpsPoints
          : routeIncludeWithTrackMatches
        : routeListInclude,
      order: [
        ["date", "DESC"],
        [{ model: RouteStop, as: "stops" }, "position", "ASC"],
      ],
    });

    return res.json(
      includeFullDetail ? routes.map(serializeRouteWithTrackMatches) : routes,
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error obteniendo rutas",
    });
  }
};

export const getMyRoutes = async (req, res) => {
  try {
    const { date } = req.query;
    const filters = {};

    if (!applyDateOnlyFilter(filters, date)) {
      return res.status(400).json({
        message: "Formato de fecha invalido. Usa YYYY-MM-DD o DD/MM/YYYY.",
      });
    }

    const routes = await Route.findAll({
      where: getRouteWhere(req, filters),
      include: routeIncludeWithTrackMatches,
      order: [
        ["date", "DESC"],
        [{ model: RouteStop, as: "stops" }, "position", "ASC"],
      ],
    });

    return res.json(routes.map(serializeRouteWithTrackMatches));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error obteniendo mis rutas",
    });
  }
};

export const getTodayRoute = async (req, res) => {
  try {
    const today = getTodayInBogota();

    const route = await Route.findOne({
      where: getRouteWhere(req, { date: today }),
      include: routeIncludeWithTrackMatches,
      order: routeOrder,
    });

    return res.json(serializeRouteWithTrackMatches(route));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error obteniendo la ruta de hoy",
    });
  }
};

export const getRouteById = async (req, res) => {
  try {
    const includeGpsPoints = req.query.includeGpsPoints === "true";

    if (includeGpsPoints) {
      await RouteGpsPoint.sync();
    }

    const route = await Route.findOne({
      where: getAdminRouteWhere(req, { id: req.params.id }),
      include: includeGpsPoints
        ? routeIncludeWithGpsPoints
        : routeIncludeWithTrackMatches,
      order: routeOrder,
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    return res.json(serializeRouteWithTrackMatches(route));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error obteniendo la ruta",
    });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const route = await Route.findOne({
      where: getRouteWhere(req, { id: req.params.id }),
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    const {
      date,
      status,
      startTime,
      endTime,
      gpsTrack,
      latitudeStart,
      longitudeStart,
      latitudeEnd,
      longitudeEnd,
    } = req.body;

    if (gpsTrack !== undefined) {
      return res.status(400).json({
        message: "Usa /routes/:id/gps-points para guardar puntos GPS",
      });
    }

    await route.update({
      date: date ?? route.date,
      advisorId: route.advisorId,
      status: status ?? route.status,
      startTime: startTime ?? route.startTime,
      endTime: endTime ?? route.endTime,
      latitudeStart: latitudeStart ?? route.latitudeStart,
      longitudeStart: longitudeStart ?? route.longitudeStart,
      latitudeEnd: latitudeEnd ?? route.latitudeEnd,
      longitudeEnd: longitudeEnd ?? route.longitudeEnd,
    });

    return res.json({
      message: "Ruta actualizada correctamente",
      route,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error actualizando la ruta",
    });
  }
};
