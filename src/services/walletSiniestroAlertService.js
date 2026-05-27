import { Wallet } from "../models/wallet/wallet.js";
import { Client } from "../models/clients/client.js";
import sendOutlookMail from "../utils/sendOutlookMail.js";

const COLOMBIA_TIME_ZONE = "America/Bogota";
// modificar horas en formato 24 horas
const ALERT_HOUR = 7;
const ALERT_MINUTE = 45;
let schedulerStarted = false;
let lastRunDateOnly = null;

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

const normalizeDateOnly = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const dateOnly = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return dateOnly || null;
};

const formatDateOnly = (dateOnly) => {
  const normalizedDate = normalizeDateOnly(dateOnly);

  if (!normalizedDate) {
    return "";
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
};

const getDayNumberFromDateOnly = (dateOnly) => {
  const normalizedDate = normalizeDateOnly(dateOnly);

  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));
};

const getDaysBetweenDateOnly = (startDateOnly, endDateOnly) => {
  const startDayNumber = getDayNumberFromDateOnly(startDateOnly);
  const endDayNumber = getDayNumberFromDateOnly(endDateOnly);

  if (startDayNumber === null || endDayNumber === null) {
    return null;
  }

  return endDayNumber - startDayNumber;
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getNextColombiaRunDate = (fromDate = new Date()) => {
  const colombiaParts = getColombiaDateParts(fromDate);
  const today = toDateOnly(colombiaParts);
  const currentMinutes =
    Number(colombiaParts.hour) * 60 + Number(colombiaParts.minute);
  const alertMinutes = ALERT_HOUR * 60 + ALERT_MINUTE;
  const runDateOnly =
    currentMinutes < alertMinutes ? today : addDaysToDateOnly(today, 1);
  const [year, month, day] = runDateOnly.split("-").map(Number);

  // Colombia does not use DST. America/Bogota is UTC-5.
  return new Date(Date.UTC(year, month - 1, day, ALERT_HOUR + 5, ALERT_MINUTE));
};

const buildWalletReportHtml = ({ rows, today, threeDaysFromToday }) => {
  const totalSaldo = rows.reduce((sum, wallet) => sum + Number(wallet.saldoReal), 0);
  const totalFacturas = rows.reduce((sum, wallet) => sum + Number(wallet.total), 0);

  const tableRows = rows
    .map((wallet) => {
      const daysUntilSiniestro = getDaysBetweenDateOnly(today, wallet.fechaSiniestro);
      let alertType = `Se vence en ${daysUntilSiniestro} dia${daysUntilSiniestro === 1 ? "" : "s"}`;

      if (daysUntilSiniestro < 0) {
        const daysPastDue = Math.abs(daysUntilSiniestro);
        alertType = `Siniestro vencido hace ${daysPastDue} dia${daysPastDue === 1 ? "" : "s"}`;
      } else if (daysUntilSiniestro === 0) {
        alertType = "Se vence hoy";
      }

      return `
        <tr>
          <td>${escapeHtml(wallet.client?.nombre || "Sin cliente")}</td>
          <td>${escapeHtml(wallet.numeroFactura)}</td>
          <td style="text-align:right;">${currencyFormatter.format(Number(wallet.total))}</td>
          <td style="text-align:right;">${currencyFormatter.format(Number(wallet.saldoReal))}</td>
          <td>${formatDateOnly(wallet.fechaSiniestro)}</td>
          <td>${alertType}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <p>Informe general de cartera con facturas proximas a fecha de siniestro.</p>
    <p>
      Se incluyen facturas con fecha de siniestro ya vencida y facturas
      proximas a siniestro desde hoy (${formatDateOnly(today)})
      hasta los proximos 3 dias (${formatDateOnly(threeDaysFromToday)}).
    </p>

    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th align="left">Cliente</th>
          <th align="left">Numero factura</th>
          <th align="right">Total factura</th>
          <th align="right">Saldo actual</th>
          <th align="left">Fecha siniestro</th>
          <th align="left">Tipo alerta</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <th colspan="2" align="left">Totales</th>
          <th align="right">${currencyFormatter.format(totalFacturas)}</th>
          <th align="right">${currencyFormatter.format(totalSaldo)}</th>
          <th colspan="2"></th>
        </tr>
      </tfoot>
    </table>
  `;
};

export const sendWalletSiniestroAlertReport = async () => {
  const to = process.env.WALLET_ALERT_EMAIL_TO || process.env.OUTLOOK_USER;

  if (!to) {
    console.warn(
      "No se envio informe de cartera: falta WALLET_ALERT_EMAIL_TO u OUTLOOK_USER",
    );
    return { success: false, message: "Falta destinatario del informe" };
  }

  const today = toDateOnly(getColombiaDateParts());
  const threeDaysFromToday = addDaysToDateOnly(today, 3);

  const clients = await Client.findAll({
    include: [
      {
        model: Wallet,
        as: "wallets",
        attributes: [
          "id",
          "numeroFactura",
          "total",
          "saldoReal",
          "fechaSiniestro",
          "status",
        ],
      },
    ],
    attributes: ["id", "nombre"],
    order: [
      ["nombre", "ASC"],
      [{ model: Wallet, as: "wallets" }, "fechaSiniestro", "ASC"],
      [{ model: Wallet, as: "wallets" }, "numeroFactura", "ASC"],
    ],
  });

  const pendingWallets = clients.flatMap((client) =>
    client.wallets
      .filter((wallet) => Number(wallet.saldoReal) > 0 && wallet.status === false)
      .map((wallet) => ({
        id: wallet.id,
        numeroFactura: wallet.numeroFactura,
        total: wallet.total,
        saldoReal: wallet.saldoReal,
        fechaSiniestro: normalizeDateOnly(wallet.fechaSiniestro),
        client: {
          id: client.id,
          nombre: client.nombre,
        },
      })),
  );

  const rows = pendingWallets.filter((wallet) => {
    const daysUntilSiniestro = getDaysBetweenDateOnly(today, wallet.fechaSiniestro);

    return daysUntilSiniestro !== null && daysUntilSiniestro <= 3;
  });

  console.log(
    `Cartera revisada: ${clients.length} clientes, ${pendingWallets.length} facturas pendientes, ${rows.length} facturas para alerta. Incluye vencidas y rango proximo: ${today} a ${threeDaysFromToday}`,
  );

  if (rows.length === 0) {
    console.log("No hay facturas para alerta de fecha siniestro");
    return { success: true, message: "No hay facturas para alertar" };
  }

  return sendOutlookMail({
    to,
    subject: `Alerta cartera - fechas de siniestro ${formatDateOnly(today)}`,
    html: buildWalletReportHtml({ rows, today, threeDaysFromToday }),
  });
};

export const startWalletSiniestroAlertScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const scheduleNextRun = () => {
    const nextRun = getNextColombiaRunDate();
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    console.log(
      `Proxima alerta de cartera programada para ${nextRun.toISOString()} (${String(ALERT_HOUR).padStart(2, "0")}:${String(ALERT_MINUTE).padStart(2, "0")} Colombia)`,
    );

    setTimeout(async () => {
      const runDateOnly = toDateOnly(getColombiaDateParts());

      try {
        if (lastRunDateOnly !== runDateOnly) {
          lastRunDateOnly = runDateOnly;
          await sendWalletSiniestroAlertReport();
        }
      } catch (error) {
        console.error("Error ejecutando alerta de cartera:", error);
      } finally {
        scheduleNextRun();
      }
    }, delay);
  };

  scheduleNextRun();
};
