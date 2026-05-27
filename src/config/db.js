import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const sequelize = new Sequelize(
  // para vercel
  process.env.DB_DATABASE,

  // para local
  // process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true, // Habilita SSL
        rejectUnauthorized: false, // Esto es necesario si estás usando SSL
      },
    },
    logging: false,
  },
);
sequelize
  .authenticate()
  .then(() => {
    if (process.env.DB_HOST !== "localhost") {
      console.log(
        "Conectado a la base de datos PostgreSQL en Digital Ocean con Sequelize",
      );
    } else {
      console.log(
        "Conectado a la base de datos PostgreSQL en LOCAL con Sequelize",
      );
    }
  })
  .catch((err) => console.error("Error al conectar a la base de datos:", err));

export default sequelize;
