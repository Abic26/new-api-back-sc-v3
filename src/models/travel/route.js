import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
export const Route = sequelize.define(
  "Route",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    advisorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("planned", "in_progress", "completed", "cancelled"),
      defaultValue: "planned",
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gpsTrack: {
      type: DataTypes.JSON,
      defaultValue: [],
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
    tableName: "routes",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["date", "advisorId"],
      },
    ],
  },
);

export default Route;
