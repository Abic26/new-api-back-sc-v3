import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { Client } from "../clients/client.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM("admin", "seller", "logistics", "adminlogistics"),
      defaultValue: "seller",
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
  },
);

User.hasMany(Client, {
  foreignKey: "userId",
});

Client.belongsTo(User, {
  foreignKey: "userId",
});

export default User;
