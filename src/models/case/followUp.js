import { BOOLEAN, DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";

export const FollowUp = sequelize.define(
  "FollowUp",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    nextFollowUp: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

Client.hasMany(FollowUp, {
  foreignKey: "clientId",
});

FollowUp.belongsTo(Client, {
  foreignKey: "clientId",
});
