import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";

export const Quote = sequelize.define(
  "Quote",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    pdf: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  },
);

Client.hasMany(Quote, {
  foreignKey: "clientId",
});

Quote.belongsTo(Client, {
  foreignKey: "clientId",
});
