import {
  Route,
  RouteGpsPoint,
  TravelTrackMatch,
} from "../../models/travel/associations.js";
import { buildMatchedTrack } from "../../services/travel/routeTrackMatchingService.js";
import {
  getAdminRouteWhere,
  getRouteWhere,
  parseTrackArray,
  routeInclude,
  routeIncludeWithGpsPoints,
  routeOrder,
  serializeRouteGpsPoint,
  serializeRouteWithTrackMatches,
} from "./travelShared.js";

const MAX_ROUTE_GPS_POINT_BATCH_SIZE = 100;

const normalizeRouteGpsPoint = (point) => {
  if (!point || typeof point !== "object") return null;

  const latitude = Number(point.lat ?? point.latitude);
  const longitude = Number(point.lng ?? point.longitude);
  const timestamp = Number(point.ts ?? point.timestamp);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(timestamp) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  const pointId = String(
    point.id ||
      `${Math.trunc(timestamp)}_${latitude.toFixed(6)}_${longitude.toFixed(6)}`,
  ).trim();

  if (!pointId) return null;

  const accuracy = Number(point.acc ?? point.accuracy);
  const speed = Number(point.spd ?? point.speed);

  return {
    pointId,
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    timestamp: Math.trunc(timestamp),
    accuracy: Number.isFinite(accuracy) ? Number(accuracy.toFixed(2)) : null,
    speed: Number.isFinite(speed) ? Number(speed.toFixed(2)) : null,
  };
};

const getRouteGpsTrack = async (routeId) => {
  await RouteGpsPoint.sync();

  const points = await RouteGpsPoint.findAll({
    where: { routeId },
    order: [["timestamp", "ASC"]],
  });

  return points.map(serializeRouteGpsPoint);
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

const selectRouteTrackSource = (route, storedRouteTrack = []) => {
  const routeTrack = storedRouteTrack.length
    ? storedRouteTrack
    : parseTrackArray(route.gpsTrack);
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

const ensureTrackMatchTable = async () => {
  await TravelTrackMatch.sync();
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

    const storedRouteTrack = requestedVisitId
      ? []
      : await getRouteGpsTrack(route.id);
    const routeTrackSource = requestedVisitId
      ? null
      : selectRouteTrackSource(route, storedRouteTrack);
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

    await RouteGpsPoint.sync();

    const updatedRoute = await Route.findByPk(route.id, {
      include: routeIncludeWithGpsPoints,
      order: routeOrder,
    });

    const primaryVisitResult = requestedVisitId ? visitResults[0] : null;

    return res.json({
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

    return res.status(500).json({
      message: "Error procesando el recorrido GPS",
    });
  }
};

export const appendRouteGpsPoints = async (req, res) => {
  try {
    await RouteGpsPoint.sync();

    const route = await Route.findOne({
      where: getRouteWhere(req, { id: req.params.id }),
    });

    if (!route) {
      return res.status(404).json({
        message: "Ruta no encontrada",
      });
    }

    const points = Array.isArray(req.body?.points) ? req.body.points : [];

    if (points.length === 0) {
      return res.status(400).json({
        message: "El lote de puntos GPS es obligatorio",
      });
    }

    if (points.length > MAX_ROUTE_GPS_POINT_BATCH_SIZE) {
      return res.status(413).json({
        message: `El lote supera el maximo de ${MAX_ROUTE_GPS_POINT_BATCH_SIZE} puntos`,
      });
    }

    const normalizedById = new Map();
    for (const point of points) {
      const normalized = normalizeRouteGpsPoint(point);
      if (!normalized) continue;

      normalizedById.set(normalized.pointId, {
        ...normalized,
        routeId: route.id,
      });
    }

    const normalizedPoints = [...normalizedById.values()];

    if (normalizedPoints.length === 0) {
      return res.status(400).json({
        message: "No hay puntos GPS validos en el lote",
      });
    }

    await RouteGpsPoint.bulkCreate(normalizedPoints, {
      ignoreDuplicates: true,
    });

    const lastPoint = normalizedPoints[normalizedPoints.length - 1];
    await route.update({
      latitudeEnd: lastPoint.latitude,
      longitudeEnd: lastPoint.longitude,
    });

    return res.status(201).json({
      message: "Puntos GPS recibidos correctamente",
      received: points.length,
      accepted: normalizedPoints.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Error guardando puntos GPS",
    });
  }
};
