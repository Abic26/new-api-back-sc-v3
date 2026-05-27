import { Wallet } from "../models/wallet/wallet.js";
import { Client } from "../models/clients/client.js";
import sendOutlookMail from "../utils/sendOutlookMail.js";

const COLOMBIA_TIME_ZONE = "America/Bogota";
// modificar horas en formato 24 horas
const ALERT_HOUR = 7;
const ALERT_MINUTE = 45;

// alertas para cada viernes
const ALERT_DAY_OF_WEEK = 5; // viernes
const DAYS_AFTER_DUE_DATE = 8;
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
  const todayDayNumber = getDayNumberFromDateOnly(today);
  const colombiaDayOfWeek = new Date(todayDayNumber * 24 * 60 * 60 * 1000)
    .getUTCDay();
  let daysUntilRun = (ALERT_DAY_OF_WEEK - colombiaDayOfWeek + 7) % 7;

  if (daysUntilRun === 0 && currentMinutes >= alertMinutes) {
    daysUntilRun = 7;
  }

  const runDateOnly = addDaysToDateOnly(today, daysUntilRun);
  const [year, month, day] = runDateOnly.split("-").map(Number);

  // Colombia does not use DST. America/Bogota is UTC-5.
  return new Date(Date.UTC(year, month - 1, day, ALERT_HOUR + 5, ALERT_MINUTE));
};

const buildWalletVencimientoReportHtml = ({ client, rows, today }) => {
  const totalSaldo = rows.reduce((sum, wallet) => sum + Number(wallet.saldoReal), 0);
  const totalFacturas = rows.reduce((sum, wallet) => sum + Number(wallet.total), 0);

  const tableRows = rows
    .map((wallet) => `
      <tr>
        <td>${escapeHtml(wallet.numeroFactura)}</td>
        <td style="text-align:right;">${currencyFormatter.format(Number(wallet.total))}</td>
        <td style="text-align:right;">${currencyFormatter.format(Number(wallet.saldoReal))}</td>
        <td>${formatDateOnly(wallet.fechaVencimiento)}</td>
        <td>${wallet.daysPastDue} dia${wallet.daysPastDue === 1 ? "" : "s"}</td>
      </tr>
    `)
    .join("");

  return `
    <p>Estimado cliente ${escapeHtml(client.nombre)},</p>
    <p>
      A la fecha ${formatDateOnly(today)}, registramos las siguientes facturas
      con vencimiento superior o igual a ${DAYS_AFTER_DUE_DATE} dias.
    </p>

    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th align="left">Numero factura</th>
          <th align="right">Total factura</th>
          <th align="right">Saldo actual</th>
          <th align="left">Fecha vencimiento</th>
          <th align="left">Dias vencida</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <th align="left">Totales</th>
          <th align="right">${currencyFormatter.format(totalFacturas)}</th>
          <th align="right">${currencyFormatter.format(totalSaldo)}</th>
          <th colspan="2"></th>
        </tr>
      </tfoot>
    </table>
  `;
};

export const sendWalletVencimientoAlertReport = async () => {
  const today = toDateOnly(getColombiaDateParts());

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
          "fechaVencimiento",
          "status",
        ],
      },
    ],
    attributes: ["id", "nombre", "correo"],
    order: [
      ["nombre", "ASC"],
      [{ model: Wallet, as: "wallets" }, "fechaVencimiento", "ASC"],
      [{ model: Wallet, as: "wallets" }, "numeroFactura", "ASC"],
    ],
  });

  const clientsWithAlerts = clients
    .map((client) => {
      const rows = client.wallets
        .filter((wallet) => Number(wallet.saldoReal) > 0 && wallet.status === false)
        .map((wallet) => {
          const fechaVencimiento = normalizeDateOnly(wallet.fechaVencimiento);
          const daysPastDue = getDaysBetweenDateOnly(fechaVencimiento, today);

          return {
            id: wallet.id,
            numeroFactura: wallet.numeroFactura,
            total: wallet.total,
            saldoReal: wallet.saldoReal,
            fechaVencimiento,
            daysPastDue,
          };
        })
        .filter(
          (wallet) =>
            wallet.daysPastDue !== null &&
            wallet.daysPastDue >= DAYS_AFTER_DUE_DATE,
        );

      return {
        id: client.id,
        nombre: client.nombre,
        correo: client.correo,
        rows,
      };
    })
    .filter((client) => client.rows.length > 0);

  console.log(
    `Cartera vencida revisada: ${clients.length} clientes, ${clientsWithAlerts.length} clientes con alerta`,
  );

  if (clientsWithAlerts.length === 0) {
    console.log("No hay facturas vencidas para alertar a clientes");
    return { success: true, message: "No hay facturas vencidas para alertar" };
  }

  const results = [];

  for (const client of clientsWithAlerts) {
    if (!client.correo) {
      console.warn(`Cliente sin correo para alerta de vencimiento: ${client.nombre}`);
      results.push({
        clientId: client.id,
        clientName: client.nombre,
        success: false,
        message: "Cliente sin correo",
      });
      continue;
    }

    const result = await sendOutlookMail({
      to: client.correo,
      subject: `Facturas vencidas - ${client.nombre}`,
      html: buildWalletVencimientoReportHtml({ client, rows: client.rows, today }),
    });

    results.push({
      clientId: client.id,
      clientName: client.nombre,
      to: client.correo,
      invoices: client.rows.length,
      ...result,
    });
  }

  return {
    success: true,
    message: "Proceso de alertas de vencimiento finalizado",
    results,
  };
};

export const startWalletVencimientoAlertScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const scheduleNextRun = () => {
    const nextRun = getNextColombiaRunDate();
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    console.log(
      `Proxima alerta de vencimiento programada para ${nextRun.toISOString()} (viernes ${String(ALERT_HOUR).padStart(2, "0")}:${String(ALERT_MINUTE).padStart(2, "0")} Colombia)`,
    );

    setTimeout(async () => {
      const runDateOnly = toDateOnly(getColombiaDateParts());

      try {
        if (lastRunDateOnly !== runDateOnly) {
          lastRunDateOnly = runDateOnly;
          await sendWalletVencimientoAlertReport();
        }
      } catch (error) {
        console.error("Error ejecutando alerta de vencimiento:", error);
      } finally {
        scheduleNextRun();
      }
    }, delay);
  };

  scheduleNextRun();
};
