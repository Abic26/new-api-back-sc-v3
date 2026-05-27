import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";

export const DataRelevant = sequelize.define(
  "data_relevant",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    valor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    idClient: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Client,
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  },
);

// 🔗 Relación
Client.hasMany(DataRelevant, { foreignKey: "idClient" });
DataRelevant.belongsTo(Client, { foreignKey: "idClient" });
