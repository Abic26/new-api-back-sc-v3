import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const TravelTrackMatch = sequelize.define(
  "TravelTrackMatch",
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
    visitId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sourceType: {
      type: DataTypes.ENUM("route", "visit"),
      allowNull: false,
    },
    gpsTrackMatched: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "travel_track_matches",
    timestamps: true,
  },
);

export default TravelTrackMatch;
