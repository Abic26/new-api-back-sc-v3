import { Client } from "../../models/clients/client.js";
import { Route, RouteStop, Visit } from "../../models/travel/associations.js";
import User from "../../models/users/user.js";
import sendOutlookMail from "../../utils/sendOutlookMail.js";
import { Op } from "sequelize";

const COLOMBIA_TIME_ZONE = "America/Bogota";

// modificar horas en formato 24 horas
const REPORT_HOUR = 12;
const REPORT_MINUTE = 15;

let schedulerStarted = false;
let lastRunDateOnly = null;

const routeInclude = [
  {
    model: User,
    as: "advisor",
    attributes: ["id", "name", "email", "role"],
  },
  {
    model: RouteStop,
    as: "stops",
    include: [
      {
        model: Client,
        as: "client",
      },
      {
        model: Visit,
        as: "visits",
      },
    ],
  },
];

const routeOrder = [
  [{ model: RouteStop, as: "stops" }, "position", "ASC"],
  [
    { model: RouteStop, as: "stops" },
    { model: Visit, as: "visits" },
    "createdAt",
    "DESC",
  ],
];

const getColombiaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const toDateOnly = ({ year, month, day }) => `${year}-${month}-${day}`;

const addDaysToDateOnly = (dateOnly, days) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  return nextDate.toISOString().slice(0, 10);
};

const getNextColombiaRunDate = (fromDate = new Date()) => {
  const colombiaParts = getColombiaDateParts(fromDate);
  const today = toDateOnly(colombiaParts);

  const currentMinutes =
    Number(colombiaParts.hour) * 60 + Number(colombiaParts.minute);

  const reportMinutes = REPORT_HOUR * 60 + REPORT_MINUTE;

  const runDateOnly =
    currentMinutes < reportMinutes ? today : addDaysToDateOnly(today, 1);

  const [year, month, day] = runDateOnly.split("-").map(Number);

  // Colombia no usa DST. America/Bogota es UTC-5.
  return new Date(
    Date.UTC(year, month - 1, day, REPORT_HOUR + 5, REPORT_MINUTE),
  );
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatDateTime = (value) => {
  if (!value) return "Sin registrar";

  const stringValue =
    value instanceof Date
      ? value.toISOString().replace("Z", "")
      : String(value).replace("Z", "");

  const [datePart, timePart] = stringValue.split("T");

  if (!datePart || !timePart) return "Sin registrar";

  const [year, month, day] = datePart.split("-");
  const [hour, minute] = timePart.split(":");

  const hourNumber = Number(hour);
  const ampm = hourNumber >= 12 ? "p. m." : "a. m.";
  const hour12 = hourNumber % 12 || 12;

  return `${day}/${month}/${year}, ${hour12}:${minute} ${ampm}`;
};

const formatDuration = (start, end) => {
  if (!start || !end) return "Sin calcular";

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    diffMs < 0
  ) {
    return "Sin calcular";
  }

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;

  return `${hours} h ${minutes} min`;
};

const statusLabel = (status) => {
  const labels = {
    planned: "Planeada",
    in_progress: "En progreso",
    done: "Realizada",
    skipped: "Omitida",
    pending: "Pendiente",
    completed: "Completada",
    cancelled: "Cancelada",
  };

  return labels[status] || status || "Sin estado";
};

const formatVisitOptions = (options = {}) => {
  const labels = {
    quotationGenerated: "Cotizacion generada",
    clientNotAvailable: "Cliente no disponible",
    successful: "Visita exitosa",
  };

  if (!options || typeof options !== "object") {
    return "Sin resultado registrado";
  }

  const selected = Object.entries(options)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => labels[key] || key);

  return selected.length ? selected.join(", ") : "Sin resultado registrado";
};

const buildTravelReportHtml = ({ route }) => {
  const stops = [...(route.stops || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const completedStops = stops.filter((stop) => stop.status === "done").length;
  const skippedStops = stops.filter((stop) => stop.status === "skipped").length;
  const pendingStops = stops.length - completedStops - skippedStops;

  const rows = stops
    .map((stop) => {
      const visits = [...(stop.visits || [])].sort(
        (a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0),
      );

      const lastVisit = visits[visits.length - 1];
      const client = stop.client || {};

      const result = lastVisit
        ? formatVisitOptions(lastVisit.options)
        : stop.skippedReason || "Sin visita registrada";

      return `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(stop.visitNumber ?? stop.position ?? "-")}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            <strong>${escapeHtml(client.nombre || stop.clientName || "Cliente sin nombre")}</strong><br />
            <span>${escapeHtml(stop.addressSnapshot || client.direccion || "Sin direccion")}</span><br />
            <span>${escapeHtml(client.ciudad || "Sin ciudad")}</span>
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(statusLabel(stop.status))}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(formatDateTime(lastVisit?.startTime))}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(formatDateTime(lastVisit?.endTime))}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(formatDuration(lastVisit?.startTime, lastVisit?.endTime))}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(result)}
          </td>

          <td style="padding:8px;border:1px solid #e2e8f0;">
            ${escapeHtml(lastVisit?.summary || stop.notes || stop.skippedReason || "Sin observaciones")}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin-bottom: 4px;">Reporte de viaje completado</h2>

      <p style="margin-top: 0; color: #475569;">
        Ruta del ${escapeHtml(route.date)} finalizada por 
        ${escapeHtml(route.advisor?.name || "asesor")}.
      </p>

      <table style="border-collapse: collapse; width: 100%; margin: 18px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Asesor</strong><br />
            ${escapeHtml(route.advisor?.name || "-")}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Inicio</strong><br />
            ${escapeHtml(formatDateTime(route.startTime))}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Fin</strong><br />
            ${escapeHtml(formatDateTime(route.endTime))}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Duracion</strong><br />
            ${escapeHtml(formatDuration(route.startTime, route.endTime))}
          </td>
        </tr>

        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Total visitas</strong><br />
            ${stops.length}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Realizadas</strong><br />
            ${completedStops}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Omitidas</strong><br />
            ${skippedStops}
          </td>

          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <strong>Pendientes</strong><br />
            ${pendingStops}
          </td>
        </tr>
      </table>

      <table style="border-collapse: collapse; width: 100%; font-size: 13px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">#</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Cliente</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Estado</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Inicio visita</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Fin visita</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Tiempo</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Resultado</th>
            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Observaciones</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows ||
            `<tr>
              <td colspan="8" style="padding: 8px; border: 1px solid #e2e8f0;">
                No hay visitas registradas.
              </td>
            </tr>`
          }
        </tbody>
      </table>
    </div>
  `;
};

const sendCompletedRouteReport = async (route) => {
  const to = process.env.TRAVEL_REPORT_EMAIL_TO;

  if (!to) {
    console.warn("No se envio reporte de viaje: falta TRAVEL_REPORT_EMAIL_TO");

    return {
      success: false,
      message: "Falta destinatario del reporte",
    };
  }

  const result = await sendOutlookMail({
    to,
    cc: route.advisor?.email || "",
    subject: `Reporte viaje ${route.date} - ${route.advisor?.name || "asesor"}`,
    html: buildTravelReportHtml({ route }),
  });

  if (!result?.success) {
    console.error("No se pudo enviar reporte de viaje:", result?.error);
  }

  return result;
};

export const sendTodayCompletedTravelReports = async () => {
  const today = toDateOnly(getColombiaDateParts());

  const routes = await Route.findAll({
    where: {
      date: today,
      status: { [Op.in]: ["completed", "in_progress"] },
    },
    include: routeInclude,
    order: routeOrder,
  });

  console.log(
    `Rutas revisadas para reporte: ${routes.length} rutas completadas en fecha ${today}`,
  );

  if (routes.length === 0) {
    console.log("No hay rutas completadas para enviar reporte");
    return {
      success: true,
      message: "No hay rutas completadas para reportar",
    };
  }

  const results = [];

  for (const route of routes) {
    try {
      const result = await sendCompletedRouteReport(route);
      results.push({
        routeId: route.id,
        success: Boolean(result?.success),
        result,
      });
    } catch (error) {
      console.error(`Error enviando reporte de ruta ${route.id}:`, error);

      results.push({
        routeId: route.id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: `Reportes procesados: ${routes.length}`,
    results,
  };
};

export const startTravelCompletedReportScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const scheduleNextRun = () => {
    const nextRun = getNextColombiaRunDate();
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    console.log(
      `Proximo reporte de viajes programado para ${nextRun.toISOString()} (${String(
        REPORT_HOUR,
      ).padStart(2, "0")}:${String(REPORT_MINUTE).padStart(2, "0")} Colombia)`,
    );

    setTimeout(async () => {
      const runDateOnly = toDateOnly(getColombiaDateParts());

      try {
        if (lastRunDateOnly !== runDateOnly) {
          lastRunDateOnly = runDateOnly;
          await sendTodayCompletedTravelReports();
        }
      } catch (error) {
        console.error("Error ejecutando reporte de viajes:", error);
      } finally {
        scheduleNextRun();
      }
    }, delay);
  };

  scheduleNextRun();
};
