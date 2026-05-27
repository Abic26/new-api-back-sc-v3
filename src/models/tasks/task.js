import { BOOLEAN, DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import User from "../users/user.js";

export const TaskUser = sequelize.define(
  "TaskUser",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    task: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    nextFollowUp: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

User.hasMany(TaskUser, {
  foreignKey: "userId",
});

TaskUser.belongsTo(User, {
  foreignKey: "userId",
});
