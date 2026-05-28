import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const RouteGpsPoint = sequelize.define(
  "RouteGpsPoint",
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
    pointId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    accuracy: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    speed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
  },
  {
    tableName: "route_gps_points",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["routeId", "pointId"],
      },
      {
        fields: ["routeId", "timestamp"],
      },
    ],
  },
);

export default RouteGpsPoint;
