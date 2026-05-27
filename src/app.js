import express from "express";
import cors from "cors";
import authRoutes from "../src/routes/auth/authRoutes.js";
import testRoutes from "../src/routes/testRoutes.js";
import clientsRoutes from "../src/routes/clients/clientsRoutes.js";
import caseRoutes from "../src/routes/case/caseRoutes.js";
import negotiationRoutes from "../src/routes/negotiation/negotiationRoutes.js";
import historyRoutes from "../src/routes/negotiation/historyRoutes.js";
import sendMail from "../src/routes/sendMail/sendMialRoutes.js";
import walletRoutes from "../src/routes/wallet/walletRoutes.js";
import dataRelevant from "../src/routes/clients/dataRelevant.routes.js";
import travelRoutes from "../src/routes/travel/travelRoutes.js";
import taskRoutes from "../src/routes/tasks/taskRoutes.js";

import { startTravelCompletedReportScheduler  } from "./services/travel/travelCompletedReportScheduler.js"


const app = express();

// app.use(
//   cors({
//     origin: ["http://localhost:3000", "http://localhost:5000", "http://localhost:63027"],
//     credentials: true,
//   }),
// );
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/negotations", negotiationRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/sendmail", sendMail);
app.use("/api/wallet", walletRoutes);
app.use("/api/datarelevant", dataRelevant);
app.use("/api/travel", travelRoutes);
app.use("/api/tasksusers", taskRoutes);

app.use("/storage", express.static("storage"));

// proceso para ejecutar el reporte de viajes
// Endpoint que ejecutará Vercel Cron

app.get("/api/cron/travel-report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        message: "No autorizado",
      });
    }

    const result = await startTravelCompletedReportScheduler();

    return res.status(200).json({
      message: "Reporte de viajes ejecutado correctamente",
      result,
    });
  } catch (error) {
    console.error("Error ejecutando cron de reporte de viajes:", error);

    return res.status(500).json({
      message: "Error ejecutando cron de reporte de viajes",
      error: error.message,
    });
  }
});

export default app;
