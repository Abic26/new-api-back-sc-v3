import sequelize from "../../src/config/db.js";
import User from "./users/user.js";
import AuthSession from "./auth/authSession.js";

const syncDatabase = async () => {
  try {

    await sequelize.authenticate();
    console.log("DB conectada");

    await sequelize.sync({ alter: true });
    console.log("Tablas sincronizadas");

  } catch (error) {
    console.error(error);
  }
};

export { sequelize, User, AuthSession, syncDatabase };
