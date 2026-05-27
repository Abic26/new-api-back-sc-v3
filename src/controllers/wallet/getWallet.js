import { Wallet } from "../../models/wallet/wallet.js";
import { HistoryWallet } from "../../models/wallet/historyWallet.js";
import { Client } from "../../models/clients/client.js";
import { Op } from "sequelize";

export const getWalletByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year, month } = req.query;

    let startDate;
    let endDate;

    // 🔥 si vienen filtros → usar esos
    if (year && month) {
      startDate = new Date(`${year}-${month}-01`);
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      // 🔥 default: mes actual
      const today = new Date();
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }

    const wallets = await Wallet.findAll({
      where: {
        clientId,
        fechaFactura: {
          [Op.gte]: startDate,
          [Op.lt]: endDate,
        },
      },
      order: [["fechaFactura", "DESC"]],
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nombre", "asesor", "userId"],
        },
        {
          model: HistoryWallet,
          as: "history",
          separate: true,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    // 🔥 TOTAL GLOBAL (sin filtro de fechas)
    const totalSaldoGlobal = await Wallet.sum("saldoReal", {
      where: {
        clientId,
      },
    });

    const walletsFormatted = wallets.map((wallet) => {
      const w = wallet.toJSON();
      w.totalSaldoCliente = totalSaldoGlobal || 0;
      return w;
    });

    res.json(walletsFormatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo las facturas del cliente",
    });
  }
};

export const getWalletByClientIdAll = async (req, res) => {
  try {
    const { clientId } = req.params;

    const wallets = await Wallet.findAll({
      where: {
        clientId,
        status: false,
      },
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: HistoryWallet,
          as: "history",
        },
      ],
    });

    res.json(wallets);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo wallets del cliente",
    });
  }
};

export const getWalletByClientIdAllWallet = async (req, res) => {
  try {
    const { clientId } = req.params;

    const wallets = await Wallet.findAll({
      where: {
        clientId,
      },
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: HistoryWallet,
          as: "history",
        },
      ],
    });

    res.json(wallets);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo wallets del cliente",
    });
  }
};
