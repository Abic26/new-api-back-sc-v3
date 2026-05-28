import User from "../users/user.js";
import { Client } from "../clients/client.js";
import { Route } from "./route.js";
import { RouteStop } from "./routeStop.js";
import { Visit } from "./visit.js";
import { TravelTrackMatch } from "./travelTrackMatch.js";
import { RouteGpsPoint } from "./routeGpsPoint.js";

User.hasMany(Route, {
  foreignKey: "advisorId",
  as: "routes",
});

Route.belongsTo(User, {
  foreignKey: "advisorId",
  as: "advisor",
});

Route.hasMany(RouteStop, {
  foreignKey: "routeId",
  as: "stops",
});

RouteStop.belongsTo(Route, {
  foreignKey: "routeId",
  as: "route",
});

Client.hasMany(RouteStop, {
  foreignKey: "clientId",
  as: "routeStops",
});

RouteStop.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

RouteStop.hasMany(Visit, {
  foreignKey: "routeStopId",
  as: "visits",
});

Visit.belongsTo(RouteStop, {
  foreignKey: "routeStopId",
  as: "routeStop",
});

Route.hasMany(TravelTrackMatch, {
  foreignKey: "routeId",
  as: "trackMatches",
});

TravelTrackMatch.belongsTo(Route, {
  foreignKey: "routeId",
  as: "route",
});

Visit.hasMany(TravelTrackMatch, {
  foreignKey: "visitId",
  as: "trackMatches",
});

TravelTrackMatch.belongsTo(Visit, {
  foreignKey: "visitId",
  as: "visit",
});

Route.hasMany(RouteGpsPoint, {
  foreignKey: "routeId",
  as: "gpsPoints",
});

RouteGpsPoint.belongsTo(Route, {
  foreignKey: "routeId",
  as: "route",
});

export { Route, RouteStop, Visit, TravelTrackMatch, RouteGpsPoint };
