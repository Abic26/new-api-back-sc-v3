import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Negotiation } from "./negotation.js";

export const NegotiationHistory = sequelize.define(
  "NegotiationHistory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    negotiationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true, // 🔥 createdAt = fecha automática
  }
);

// ==============================
// RELACIONES
// ==============================

Negotiation.hasMany(NegotiationHistory, {
  foreignKey: "negotiationId",
  as: "history",
});

NegotiationHistory.belongsTo(Negotiation, {
  foreignKey: "negotiationId",
});