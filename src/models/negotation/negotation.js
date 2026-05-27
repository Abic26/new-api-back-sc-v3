import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";

export const Negotiation = sequelize.define(
  "Negotiation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    total: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pdf: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("pending", "won", "lost"),
      allowNull: false,
      defaultValue: "pending",
    },

    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true, // createdAt = fecha de creación
  },
);

// relaciones
Client.hasMany(Negotiation, {
  foreignKey: "clientId",
});

Negotiation.belongsTo(Client, {
  foreignKey: "clientId",
});
