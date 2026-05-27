import { Client } from "../../models/clients/client.js";
import {
  Route,
  RouteStop,
  TravelTrackMatch,
  Visit,
} from "../../models/travel/associations.js";
import { buildMatchedTrack } from "../../services/travel/routeTrackMatchingService.js";
import User from "../../models/users/user.js";
import { Op, Sequelize } from "sequelize";

const routeInclude = [
  {
    model: User,
    as: "advisor",
    attributes: ["id", "name", "email", "role"],
  },
  {
    model: RouteStop,
    as: "stops",
    include: [
      {
        model: Client,
        as: "client",
      },
      {
        model: Visit,
        as: "visits",
      },
    ],
  },
];

const routeIncludeWithTrackMatches = [
  {
    model: User,
    as: "advisor",
    attributes: ["id", "name", "email", "role"],
  },
  {
    model: RouteStop,
    as: "stops",
    include: [
      {
        model: Client,
        as: "client",
      },
      {
        model: Visit,
        as: "visits",
        include: [
          {
            model: TravelTrackMatch,
            as: "trackMatches",
          },
        ],
      },
    ],
  },
  {
    model: TravelTrackMatch,
    as: "trackMatches",
  },
];

const routeListInclude = [
  {
    model: User,
    as: "advisor",
    attributes: ["id", "name", "email", "role"],
  },
  {
    model: RouteStop,
    as: "stops",
    attributes: [
      "id",
      "routeId",
      "clientId",
      "visitNumber",
      "position",
      "plannedTime",
      "addressSnapshot",
      "status",
      "isVisited",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id", "nombre", "direccion", "ciudad"],
      },
      {
        model: Visit,
        as: "visits",
        attributes: [
          "id",
          "routeStopId",
          "startTime",
          "endTime",
          "status",
          "latitudeStart",
          "longitudeStart",
          "latitudeEnd",
          "longitudeEnd",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
  },
];

const routeListAttributes = {
  exclude: ["gpsTrack"],
  include: [
    [
      Sequelize.literal(
        `jsonb_array_length(COALESCE("Route"."gpsTrack"::jsonb, '[]'::jsonb))`,
      ),
      "gpsPointCount",
    ],
    [
      Sequelize.literal(`(
        SELECT COALESCE(SUM(jsonb_array_length(COALESCE(v."gpsTrack"::jsonb, '[]'::jsonb))), 0)::int
        FROM "route_stops" rs
        INNER JOIN "visits" v ON v."routeStopId" = rs."id"
        WHERE rs."routeId" = "Route"."id"
      )`),
      "visitGpsPointCount",
    ],
  ],
};

const routeOrder = [
  [{ model: RouteStop, as: "stops" }, "position", "ASC"],
  [
    { model: RouteStop, as: "stops" },
    { model: Visit, as: "visits" },
    "createdAt",
    "DESC",
  ],
];

const getRouteWhere = (req, extraWhere = {}) => {
  return {
    ...extraWhere,
    advisorId: req.user.id,
  };
};

const getAdminRouteWhere = (req, extraWhere = {}) => {
  if (req.user.role === "admin") return extraWhere;
  return getRouteWhere(req, extraWhere);
};

const normalizeDateOnlyFilter = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const localMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
};

const applyDateOnlyFilter = (filters, date) => {
  const normalizedDate = date
    ? normalizeDateOnlyFilter(date)
    : getTodayInBogota();
  if (!normalizedDate) return false;

  filters.date = normalizedDate;
  return true;
};

const userOwnsRoute = (req, route) => {
  return route?.advisorId === req.user.id;
};

const upsertTrackMatch = async ({
  routeId,
  visitId = null,
  sourceType,
  matched,
}) => {
  const where = {
    routeId,
    sourceType,
    visitId,
  };

  const payload = {
    ...where,
    gpsTrackMatched: matched.track,
    status: matched.status,
    error: matched.error,
    processedAt: new Date(),
  };

  const existing = await TravelTrackMatch.findOne({ where });
  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return TravelTrackMatch.create(payload);
};

const parseTrackArray = (track) => {
  if (Array.isArray(track)) return track;

  if (typeof track === "string") {
    try {
      const parsed = JSON.parse(track);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const collectVisitTracks = (route) => {
  return (route.stops || [])
    .flatMap((stop) => stop.visits || [])
    .sort(
      (a, b) =>
        new Date(a.startTime || a.createdAt || 0).getTime() -
        new Date(b.startTime || b.createdAt || 0).getTime(),
    )
    .flatMap((visit) => parseTrackArray(visit.gpsTrack))
    .sort((a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0));
};

const firstTrackTimestamp = (track) => {
  const value = Number(track?.[0]?.timestamp);
  return Number.isFinite(value) ? value : null;
};

const lastTrackTimestamp = (track) => {
  const value = Number(track?.[track.length - 1]?.timestamp);
  return Number.isFinite(value) ? value : null;
};

const selectRouteTrackSource = (route) => {
  const routeTrack = parseTrackArray(route.gpsTrack);
  const visitTrack = collectVisitTracks(route);

  if (visitTrack.length < 2) {
    return { track: routeTrack, source: "route" };
  }

  const routeStart = firstTrackTimestamp(routeTrack);
  const routeEnd = lastTrackTimestamp(routeTrack);
  const visitStart = firstTrackTimestamp(visitTrack);
  const visitEnd = lastTrackTimestamp(visitTrack);
  const visitHasBetterCoverage =
    routeTrack.length < 2 ||
    visitTrack.length > routeTrack.length * 1.25 ||
    (routeStart !== null &&
      visitStart !== null &&
      visitStart < routeStart - 300000) ||
    (routeEnd !== null && visitEnd !== null && visitEnd > routeEnd + 300000);

  return visitHasBetterCoverage
    ? { track: visitTrack, source: "visits" }
    : { track: routeTrack, source: "route" };
};

const serializeRouteWithTrackMatches = (route) => {
  if (!route) return route;

  const plainRoute = route.toJSON ? route.toJSON() : route;
  const matches = plainRoute.trackMatches || [];
  const uniqueById = (items) => {
    const seen = new Set();

    return items.filter((item) => {
      const key = item.id || `${item.sourceType}-${item.visitId || "route"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    ...plainRoute,
    stops: (plainRoute.stops || []).map((stop) => ({
      ...stop,
      visits: (stop.visits || []).map((visit) => ({
        ...visit,
        trackMatches: uniqueById([
          ...(visit.trackMatches || []),
          ...matches.filter(
            (match) =>
              match.sourceType === "visit" &&
              match.visitId &&
              match.visitId === visit.id,
          ),
        ]),
      })),
    })),
  };
};

const ensureTrackMatchTable = async () => {
  await TravelTrackMatch.sync();
};

const getTodayInBogota = () => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

const findClientByName = async (clientName, req) => {
  const name = clientName?.toString().trim();
  if (!name) return null;

  const where = {
    nombre: {
      [Op.iLike]: `%${name}%`,
    },
  };

  where.userId = req.user.id;

  return Client.findOne({ where });
};

const findClientById = async (clientId, req) => {
  if (!clientId) return null;

  return Client.findOne({
    where: {
      id: clientId,
      userId: req.user.id,
    },
  });
};

const normalizeStops = async (stops = [], req) => {
  const normalized = [];
  const missingClients = [];

  for (const [index, stop] of stops.entries()) {
    let clientId = stop.clientId;
    let client = null;

    if (clientId) {
      client = await findClientById(clientId, req);
      clientId = client?.id;
    }

    if (!clientId) {
      client = await findClientByName(stop.clientName, req);
      clientId = client?.id;
    }

    if (!clientId) {
      missingClients.push(stop.clientName || `Fila ${index + 1}`);
      continue;
    }

    normalized.push({
      clientId,
      clientName: stop.clientName,
      visitNumber: stop.visitNumber ?? 1,
      position: stop.position ?? index + 1,
      plannedTime: stop.plannedTime ?? null,
      addressSnapshot: stop.addressSnapshot ?? null,
      notes: stop.notes ?? null,
      skippedReason: stop.skippedReason ?? null,
      status: stop.status ?? "planned",
      isVisited: stop.isVisited ?? false,
    });
  }

  return { normalized, missingClients };
};

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

    res.status(201).json(routeCreated);
  } catch (error) {
    console.error(error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Ya existe una ruta para este asesor en esta fecha",
      });
    }

    res.status(500).json({
      message: "Error creando la ruta",
    });
  }
};

export const getRoutes = async (req, res) => {
  try {
    const { date, advisorId, detail } = req.query;
    const filters = {};
    const includeFullDetail = detail === "full";

    if (!applyDateOnlyFilter(filters, date)) {
      return res.status(400).json({
        message: "Formato de fecha invalido. Usa YYYY-MM-DD o DD/MM/YYYY.",
      });
    }

    if (req.user.role === "admin" && advisorId) filters.advisorId = advisorId;

    const routes = await Route.findAll({
      where: getAdminRouteWhere(req, filters),
      attributes: includeFullDetail ? undefined : routeListAttributes,
      include: includeFullDetail
        ? routeIncludeWithTrackMatches
        : routeListInclude,
      order: [
        ["date", "DESC"],
        [{ model: RouteStop, as: "stops" }, "position", "ASC"],
      ],
    });

    res.json(
      includeFullDetail ? routes.map(serializeRouteWithTrackMatches) : routes,
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    res.json(routes.map(serializeRouteWithTrackMatches));
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    res.json(serializeRouteWithTrackMatches(route));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo la ruta de hoy",
    });
  }
};

export const getRouteById = async (req, res) => {
  try {
    const route = await Route.findOne({
      where: getAdminRouteWhere(req, { id: req.params.id }),
      include: routeIncludeWithTrackMatches,
      order: routeOrder,
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    res.json(serializeRouteWithTrackMatches(route));
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    await route.update({
      date: date ?? route.date,
      advisorId: route.advisorId,
      status: status ?? route.status,
      startTime: startTime ?? route.startTime,
      endTime: endTime ?? route.endTime,
      gpsTrack: gpsTrack ?? route.gpsTrack,
      latitudeStart: latitudeStart ?? route.latitudeStart,
      longitudeStart: longitudeStart ?? route.longitudeStart,
      latitudeEnd: latitudeEnd ?? route.latitudeEnd,
      longitudeEnd: longitudeEnd ?? route.longitudeEnd,
    });

    res.json({
      message: "Ruta actualizada correctamente",
      route,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando la ruta",
    });
  }
};

export const matchRouteTrack = async (req, res) => {
  try {
    await ensureTrackMatchTable();
    const requestedVisitId = req.body?.visitId || req.query?.visitId || null;

    const route = await Route.findOne({
      where: getAdminRouteWhere(req, { id: req.params.id }),
      include: routeInclude,
      order: routeOrder,
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    const routeTrackSource = requestedVisitId
      ? null
      : selectRouteTrackSource(route);
    const matchedRoute = routeTrackSource
      ? await buildMatchedTrack(routeTrackSource.track)
      : { track: [], status: "skipped:visit-only", error: null };
    let routeTrackMatch = null;

    if (matchedRoute.track.length) {
      routeTrackMatch = await upsertTrackMatch({
        routeId: route.id,
        sourceType: "route",
        matched: matchedRoute,
      });
    }

    const visitResults = [];
    const visitTrackMatches = [];
    const stops = route.stops || [];

    for (const stop of stops) {
      const visits = stop.visits || [];

      for (const visit of visits) {
        if (requestedVisitId && visit.id !== requestedVisitId) continue;

        const matchedVisit = await buildMatchedTrack(visit.gpsTrack);
        let visitTrackMatch = null;

        if (matchedVisit.track.length) {
          visitTrackMatch = await upsertTrackMatch({
            routeId: route.id,
            visitId: visit.id,
            sourceType: "visit",
            matched: matchedVisit,
          });

          visitTrackMatches.push(visitTrackMatch);
        }

        visitResults.push({
          visitId: visit.id,
          routeStopId: stop.id,
          status: matchedVisit.status,
          points: matchedVisit.track.length,
          error: matchedVisit.error,
        });
      }
    }

    if (requestedVisitId && !visitResults.length) {
      return res.status(404).json({
        message: "Visita no encontrada en la ruta",
      });
    }

    const updatedRoute = await Route.findByPk(route.id, {
      include: routeIncludeWithTrackMatches,
      order: routeOrder,
    });

    const primaryVisitResult = requestedVisitId ? visitResults[0] : null;

    res.json({
      message: "Recorrido GPS procesado correctamente",
      routeId: route.id,
      status: primaryVisitResult?.status || matchedRoute.status,
      source: requestedVisitId ? "visit" : routeTrackSource.source,
      points: primaryVisitResult?.points ?? matchedRoute.track.length,
      error: primaryVisitResult?.error || matchedRoute.error,
      visits: visitResults,
      routeTrackMatch,
      visitTrackMatches,
      route: serializeRouteWithTrackMatches(updatedRoute),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error procesando el recorrido GPS",
    });
  }
};

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

    res.status(201).json(stop);
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    res.json({
      message: "Parada actualizada correctamente",
      stop,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando la parada",
    });
  }
};

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

    res.status(201).json(visit);
  } catch (error) {
    console.error(error);

    res.status(500).json({
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

    await visit.update({
      startTime: startTime ?? visit.startTime,
      endTime: endTime ?? visit.endTime,
      status: status ?? visit.status,
      summary: summary ?? visit.summary,
      gpsTrack: gpsTrack ?? visit.gpsTrack,
      options: options ?? visit.options,
      latitudeStart: latitudeStart ?? visit.latitudeStart,
      longitudeStart: longitudeStart ?? visit.longitudeStart,
      latitudeEnd: latitudeEnd ?? visit.latitudeEnd,
      longitudeEnd: longitudeEnd ?? visit.longitudeEnd,
    });

    if (status === "completed") {
      await visit.routeStop.update({ status: "done", isVisited: true });
    }

    res.json({
      message: "Visita actualizada correctamente",
      visit,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando la visita",
    });
  }
};
