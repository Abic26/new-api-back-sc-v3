import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

export const Client = sequelize.define("Client", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  asesor: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  contactoCel: {
    type: DataTypes.STRING,
  },

  tel: {
    type: DataTypes.STRING,
  },

  correo: {
    type: DataTypes.STRING,
  },

  rut: {
    type: DataTypes.STRING,
  },

  pais: {
    type: DataTypes.STRING,
  },

  ciudad: {
    type: DataTypes.STRING,
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  typeClient: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [
        [
          "Almacen",
          "Empresa de ingenieria",
          "Industria",
          "Obra",
          "Empresa de Energia",
          "Servicios Publicos",
          "Otro",
        ],
      ],
    },
  },
  potentialClient: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  notPotentialClient: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  barrio: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  canal: {
    type: DataTypes.ENUM("Organico", "Pagina"),
    allowNull: true,
  },
  correoCartera: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombreCartera: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});
