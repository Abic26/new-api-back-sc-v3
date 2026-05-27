import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const HistoryWallet = sequelize.define(
  "history_wallet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    walletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "wallet_id",
    },

    nota: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    tipoPago: {
      type: DataTypes.ENUM(
        "CAJA",
        "B. OCCIDENTE",
        "B. BANCOLOMBIA",
        "CREDITO DIRECTO",
        "CESCE",
        "CHEQUE",
      ),
      allowNull: true,
      field: "tipo_pago",
    },
    abono: {
      type: DataTypes.FLOAT,
      field: "abono",
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: "history_wallets",
  },
);
