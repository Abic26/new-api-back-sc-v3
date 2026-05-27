import { Wallet } from "../../models/wallet/wallet.js";
import { Client } from "../../models/clients/client.js";
import { Op } from "sequelize";
import { normalizeText, calculateDates } from "../../utils/wallet.utils.js";

// helpers para redondear decimales
const toInt = (value) => Math.round(Number(value) || 0);

export const createWallet = async (req, res) => {
  try {
    const {
      clientName, // 👈 viene del Excel
      tipComp,
      numeroFactura,
      fechaFactura,
      valorVenta,
      otrosCargos,
      valorDescuentos,
      valorNeto,
      valorRetencion,
      valorReteica,
      iva,
      total,
    } = req.body;

    // ✅ Validación básica
    if (
      !clientName ||
      !tipComp ||
      !numeroFactura ||
      !fechaFactura ||
      !valorVenta ||
      !valorNeto ||
      !total
    ) {
      return res.status(400).json({
        message: "Campos obligatorios faltantes",
      });
    }

    const normalizedInput = normalizeText(clientName);

    // 🔍 Buscar posibles coincidencias
    const possibleClients = await Client.findAll({
      where: {
        nombre: {
          [Op.iLike]: `%${clientName.trim()}%`,
        },
      },
    });

    // 🧠 Intentar match exacto normalizado
    let client =
      possibleClients.find(
        (c) => normalizeText(c.nombre) === normalizedInput,
      ) || null;

    // 🔁 Fallback: tomar el más cercano si existe alguno
    if (!client && possibleClients.length > 0) {
      client = possibleClients[0];
    }

    // ❌ No encontrado
    if (!client) {
      return res.status(404).json({
        message: "Cliente no encontrado",
        input: {
          clientName,
        },
      });
    }
    // 🔍 Validar si la factura ya existe para ese cliente
    const numeroFacturaClean = numeroFactura.toString().trim();
    const existingWallet = await Wallet.findOne({
      where: {
        clientId: client.id,
        numeroFactura: numeroFacturaClean,
      },
    });

    if (existingWallet) {
      return res.status(409).json({
        message: "Esta factura ya existe para este cliente",
        facturaDuplicada: {
          numeroFactura,
          clientId: client.id,
        },
      });
    }

    // 📅 Validar fecha
    if (isNaN(Date.parse(fechaFactura))) {
      return res.status(400).json({
        message: "Formato de fecha inválido",
      });
    }

    const calculatedDates = calculateDates(fechaFactura);

    if (!calculatedDates) {
      return res.status(400).json({
        message: "Error calculando fechas",
      });
    }

    // 💾 Crear wallet
    const newWallet = await Wallet.create({
      clientId: client.id,
      tipComp,
      numeroFactura: numeroFactura.toString().trim(), // 👈 FIX
      fechaFactura,
      valorVenta:toInt(valorVenta),
      otrosCargos: toInt(otrosCargos) || 0,
      valorDescuentos: toInt(valorDescuentos) || 0,
      valorNeto: toInt(valorNeto),
      valorRetencion: toInt(valorRetencion) || 0,
      valorReteica: toInt(valorReteica) || 0,
      iva: toInt(iva) || 0,
      total: toInt(total),
      saldoReal: toInt(total),
      fechaVencimiento: calculatedDates.fechaVencimiento,
      fechaSiniestro: calculatedDates.fechaSiniestro,
    });

    res.status(201).json({
      message: "Factura creada correctamente",
      wallet: newWallet,
      client: {
        id: client.id,
        nombre: client.nombre,
      },
      fechasCalculadas: calculatedDates,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Factura duplicada detectada (DB)",
      });
    }

    res.status(500).json({
      message: "Error creando la factura",
    });
  }
};
