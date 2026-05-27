// src/utils/wallet.utils.js

// 🔧 Normalizador de texto
export const normalizeText = (text) => {
  return text
    ?.toString()
    .toLowerCase()
    .trim()
    .normalize("NFD") // quita tildes
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " "); // espacios duplicados
};

// 🔥 Formato seguro YYYY-MM-DD (SIN problemas de zona horaria)
export const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculateDates = (fechaFactura) => {
  const baseDate = parseLocalDate(fechaFactura);

  if (isNaN(baseDate)) return null;

  // 🔥 SOLO UNA VEZ
  baseDate.setDate(baseDate.getDate() - 1);

  // despues de la fecha de factura hace el calculo
  // vencimiento 29 dias
  // siniestro 87 dias

  const fechaVencimiento = new Date(baseDate);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

  const fechaSiniestro = new Date(baseDate);
  fechaSiniestro.setDate(fechaSiniestro.getDate() + 88);

  return {
    fechaVencimiento: formatDate(fechaVencimiento),
    fechaSiniestro: formatDate(fechaSiniestro),
  };
};
