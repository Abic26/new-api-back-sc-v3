import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { spawn } from "child_process";

let botProcessRunning = false;
let botSocket = null;

export const initBotSocket = (server) => {
  const wss = new WebSocketServer({ server });

  // 🔁 función para reintentar conexión al bot
  const connectToBot = (retries = 10, delay = 1000) => {
    return new Promise((resolve, reject) => {
      const tryConnect = (attempt) => {
        console.log(`🔄 Intento conexión bot: ${attempt}`);

        const ws = new WebSocket("ws://127.0.0.1:8000");

        ws.on("open", () => {
          console.log("🤖 Conectado al bot");
          resolve(ws);
        });

        ws.on("error", () => {
          ws.close();

          if (attempt >= retries) {
            reject(new Error("No se pudo conectar al bot"));
          } else {
            setTimeout(() => tryConnect(attempt + 1), delay);
          }
        });
      };

      tryConnect(1);
    });
  };

  wss.on("connection", (client) => {
    console.log("🟢 Front conectado");

    let botSocket = null;

    client.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        // 🛑 STOP
        if (data.action === "stop" && botSocket) {
          botSocket.send(JSON.stringify({ action: "stop" }));
          return;
        }

        // 🚀 1. Ejecutar bot si no está corriendo
        if (data.action === "start") {
          if (!botProcessRunning) {
            console.log("🚀 Ejecutando bot...");

            const botPath =
              "C:\\Users\\andres.lopez.JDELECTRICOS\\Documents\\codes\\seguimiento-clientes\\bot-sendmail\\run_bot.bat";

            const botProcess = spawn("cmd.exe", ["/c", botPath]);

            botProcess.on("error", (err) => {
              console.error("❌ Error al ejecutar bot:", err);
            });

            botProcess.stdout.on("data", (data) => {
              console.log(`BOT: ${data}`);
            });

            botProcess.stderr.on("data", (data) => {
              console.error(`BOT ERROR: ${data}`);
            });

            botProcessRunning = true;
          }

          // 🔌 2. Conectar con reintentos (CLAVE)
          botSocket = await connectToBot();

          // 📤 3. Enviar data al bot
          botSocket.send(JSON.stringify(data));

          // 📩 4. Reenviar logs al frontend
          botSocket.on("message", (botMsg) => {
            client.send(botMsg.toString());
          });

          botSocket.on("close", () => {
            console.log("🔴 Bot desconectado");
            botProcessRunning = false;
          });

          botSocket.on("error", (err) => {
            console.error("❌ Error bot:", err);
            botProcessRunning = false;
          });
        }
      } catch (err) {
        console.error("❌ Error general:", err);

        client.send(
          JSON.stringify({
            type: "error",
            message: "Error al procesar el bot",
          }),
        );
      }
    });

    client.on("close", () => {
      console.log("🔴 Front desconectado");
    });
  });

  return wss;
};
