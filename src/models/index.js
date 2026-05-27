import sequelize from "../../src/config/db.js";
import User from "./users/user.js";
import AuthSession from "./auth/authSession.js";

const syncDatabase = async ({ alter = true  } = {}) => {
  try {
    await sequelize.authenticate();
    console.log("DB conectada");

    if (alter) {
      await sequelize.sync({ alter: true });
      console.log("Tablas sincronizadas con alter true");
    } else {
      console.log("DB conectada sin sincronizar tablas");
    }

    return {
      success: true,
      message: alter
        ? "DB conectada y tablas sincronizadas"
        : "DB conectada sin sincronizar tablas",
    };
  } catch (error) {
    console.error("Error al conectar o sincronizar la DB:", error);
    throw error;
  }
};

export { sequelize, User, AuthSession, syncDatabase };
