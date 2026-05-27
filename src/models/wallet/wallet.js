import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";
import { HistoryWallet } from "./historyWallet.js";

export const Wallet = sequelize.define(
  "wallet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Client,
        key: "id",
      },
    },

    tipComp: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "tip_comp",
    },

    numeroFactura: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "numero_factura",
    },

    fechaFactura: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "fecha_factura",
      get() {
        const rawValue = this.getDataValue("fechaFactura");
        if (!rawValue) return null;
        return rawValue; // formato YYYY-MM-DD automático
      },
    },

    valorVenta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "valor_venta",
    },

    otrosCargos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "otros_cargos",
    },

    valorDescuentos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "valor_descuentos",
    },

    valorNeto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "valor_neto",
    },

    valorRetencion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "valor_retencion",
    },

    valorReteica: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "valor_reteica",
    },

    iva: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "iva",
    },

    total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "total",
    },
    fechaVencimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "fecha_vencimiento",
      get() {
        const rawValue = this.getDataValue("fechaVencimiento");
        if (!rawValue) return null;
        return rawValue; // formato YYYY-MM-DD automático
      },
    },
    fechaSiniestro: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "fecha_siniestro",
      get() {
        const rawValue = this.getDataValue("fechaSiniestro");
        if (!rawValue) return null;
        return rawValue; // formato YYYY-MM-DD automático
      },
    },
    saldoReal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "saldo_real",
      defaultValue: 0,
    },
    abono: {
      type: DataTypes.INTEGER,
      field: "abono",
      defaultValue: 0,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: "wallets",
    indexes: [
      {
        unique: true,
        fields: ["clientId", "numero_factura"],
      },
    ],
  },
);

// Un cliente tiene muchas facturas (wallet)
Client.hasMany(Wallet, {
  foreignKey: "clientId",
  as: "wallets",
});

// Una factura pertenece a un cliente
Wallet.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

// Wallet -> muchos history
Wallet.hasMany(HistoryWallet, {
  foreignKey: "walletId",
  as: "history",
});

// History -> pertenece a wallet
HistoryWallet.belongsTo(Wallet, {
  foreignKey: "walletId",
  as: "wallet",
});
