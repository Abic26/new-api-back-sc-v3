import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const RouteStop = sequelize.define(
  "RouteStop",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    routeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    visitNumber: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    plannedTime: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    addressSnapshot: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    skippedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("planned", "in_progress", "done", "skipped"),
      defaultValue: "planned",
    },
    isVisited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "route_stops",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["routeId", "clientId", "visitNumber"],
      },
      {
        fields: ["routeId", "position"],
      },
    ],
  },
);

export default RouteStop;
