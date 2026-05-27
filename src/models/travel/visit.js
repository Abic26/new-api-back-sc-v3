import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const Visit = sequelize.define(
  "Visit",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    routeStopId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "in_progress", "completed", "cancelled"),
      defaultValue: "pending",
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gpsTrack: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    options: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    latitudeStart: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitudeStart: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    latitudeEnd: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitudeEnd: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
  },
  {
    tableName: "visits",
    timestamps: true,
  },
);

export default Visit;
