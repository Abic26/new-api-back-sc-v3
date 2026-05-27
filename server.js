import http from "http";
import app from "./src/app.js";
import { syncDatabase } from "./src/models/index.js";
// import { initBotSocket } from "./src/services/botSocket.js";
import { startWalletSiniestroAlertScheduler } from "./src/services/walletSiniestroAlertService.js";
import { startWalletVencimientoAlertScheduler } from "./src/services/walletVencimientoAlertService.js";
import { startTravelCompletedReportScheduler  } from "./src/services/travel/travelCompletedReportScheduler.js"
const PORT = process.env.PORT || 4000;
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

console.log(`

     ██╗██████╗        ██████╗██████╗ ███╗   ███╗
     ██║██╔══██╗      ██╔════╝██╔══██╗████╗ ████║
     ██║██║  ██║█████╗██║     ██████╔╝██╔████╔██║
██   ██║██║  ██║╚════╝██║     ██╔══██╗██║╚██╔╝██║
╚█████╔╝██████╔╝      ╚██████╗██║  ██║██║ ╚═╝ ██║
 ╚════╝ ╚═════╝        ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝

                 by ABIC 🚀
`);

const start = async () => {
  await syncDatabase();

  // ✅ crear servidor HTTP real
  const server = http.createServer(app);

  // ✅ inicializar socket AQUÍ
  // initBotSocket(server);

  // inicializacion para programar las tareas tanto envio de reporte cartera a johanna y a clientes
  startWalletSiniestroAlertScheduler();
  startWalletVencimientoAlertScheduler();
  startTravelCompletedReportScheduler();


  server.listen(PORT, () => {
    console.log("Servidor corriendo en puerto " + PORT);
  });
};

if (!isVercel) {
  start();
}

export default app;
