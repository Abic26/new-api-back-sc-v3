import { Op, Sequelize } from "sequelize";
import { Client } from "../../models/clients/client.js";
import User from "../../models/users/user.js";
import {
  RouteStop,
  RouteGpsPoint,
  TravelTrackMatch,
  Visit,
} from "../../models/travel/associations.js";

export const serializeRouteGpsPoint = (point) => ({
  id: point.pointId,
  lat: Number(point.latitude),
  lng: Number(point.longitude),
  timestamp: Number(point.timestamp),
  accuracy: point.accuracy == null ? null : Number(point.accuracy),
  speed: point.speed == null ? null : Number(point.speed),
});

export const routeInclude = [
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

export const routeIncludeWithTrackMatches = [
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

export const routeGpsPointsInclude = {
  model: RouteGpsPoint,
  as: "gpsPoints",
  attributes: [
    "pointId",
    "latitude",
    "longitude",
    "timestamp",
    "accuracy",
    "speed",
  ],
  separate: true,
  order: [["timestamp", "ASC"]],
};

export const routeIncludeWithGpsPoints = [
  ...routeIncludeWithTrackMatches,
  routeGpsPointsInclude,
];

export const routeListInclude = [
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

export const routeListAttributes = {
  exclude: ["gpsTrack"],
  include: [
    [
      Sequelize.literal(
        `GREATEST(
          (
            SELECT COUNT(*)::int
            FROM "route_gps_points" rgp
            WHERE rgp."routeId" = "Route"."id"
          ),
          jsonb_array_length(COALESCE("Route"."gpsTrack"::jsonb, '[]'::jsonb))
        )`,
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

export const routeOrder = [
  [{ model: RouteStop, as: "stops" }, "position", "ASC"],
  [
    { model: RouteStop, as: "stops" },
    { model: Visit, as: "visits" },
    "createdAt",
    "DESC",
  ],
];

export const getRouteWhere = (req, extraWhere = {}) => ({
  ...extraWhere,
  advisorId: req.user.id,
});

export const getAdminRouteWhere = (req, extraWhere = {}) => {
  if (req.user.role === "admin") return extraWhere;
  return getRouteWhere(req, extraWhere);
};

export const getTodayInBogota = () => {
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

export const applyDateOnlyFilter = (filters, date) => {
  const normalizedDate = date
    ? normalizeDateOnlyFilter(date)
    : getTodayInBogota();
  if (!normalizedDate) return false;

  filters.date = normalizedDate;
  return true;
};

export const userOwnsRoute = (req, route) => {
  return route?.advisorId === req.user.id;
};

export const parseTrackArray = (track) => {
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

export const serializeRouteWithTrackMatches = (route) => {
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
    gpsPoints: (plainRoute.gpsPoints || []).map(serializeRouteGpsPoint),
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

const findClientByName = async (clientName, req) => {
  const name = clientName?.toString().trim();
  if (!name) return null;

  return Client.findOne({
    where: {
      nombre: {
        [Op.iLike]: `%${name}%`,
      },
      userId: req.user.id,
    },
  });
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

export const normalizeStops = async (stops = [], req) => {
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
