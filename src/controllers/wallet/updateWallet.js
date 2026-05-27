import { Wallet } from "../../models/wallet/wallet.js";
import { HistoryWallet } from "../../models/wallet/historyWallet.js";

export const updateWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const { abono, nota, tipoPago, status } = req.body;

    const wallet = await Wallet.findByPk(id);

    if (!wallet) {
      return res.status(404).json({
        message: "Factura no encontrada",
      });
    }

    // 🧠 Validaciones
    if (nota && nota.length > 5000) {
      return res.status(400).json({
        message: "La nota es demasiado larga",
      });
    }

    if (status !== undefined && typeof status !== "boolean") {
      return res.status(400).json({
        message: "El status debe ser true o false",
      });
    }

    // =========================
    // 🔥 LÓGICA DE NEGOCIO
    // =========================
    let nuevoSaldo = wallet.saldoReal;
    let nuevoAbono = wallet.abono;

    if (abono > 0) {
      nuevoSaldo = wallet.saldoReal - abono;
      nuevoAbono = (wallet.abono || 0) + abono;

      if (nuevoSaldo <= 0) {
        nuevoSaldo = 0;
      }
    }

    // 🔥 status automático
    let nuevoStatus = wallet.status;

    if (nuevoSaldo === 0) {
      nuevoStatus = true;
    } else if (status !== undefined) {
      nuevoStatus = status;
    }

    // =========================
    // 🧾 CREAR HISTORIAL
    // =========================
    if (nota || abono > 0 || tipoPago) {
      await HistoryWallet.create({
        walletId: wallet.id,
        nota: nota || "Movimiento sin nota",
        tipoPago: tipoPago || null,
        abono: abono,
      });
    }

    // =========================
    // 💾 ACTUALIZAR WALLET
    // =========================
    await wallet.update({
      abono: nuevoAbono,
      saldoReal: nuevoSaldo,
      status: nuevoStatus,
    });

    res.status(200).json({
      message: "Factura actualizada correctamente",
      wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error actualizando la factura",
    });
  }
};
