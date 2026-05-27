import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const MailData = sequelize.define(
  "MailData",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    template: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // cambiar las categorias por las que me pase juan 
    typeTemplate: {
      type: DataTypes.ENUM("Saludo", "Promoción", "Oferta Comercial"),
      allowNull: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  },
);

export default MailData;
