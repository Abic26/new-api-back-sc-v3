import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import User from "../users/user.js";

const AuthSession = sequelize.define(
  "AuthSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: ["userId"],
      },
      {
        fields: ["expiresAt"],
      },
    ],
  },
);

User.hasMany(AuthSession, {
  foreignKey: "userId",
  as: "authSessions",
});

AuthSession.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

export default AuthSession;
