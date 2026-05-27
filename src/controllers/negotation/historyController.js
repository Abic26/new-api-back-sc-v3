import { NegotiationHistory } from "../../models/negotation/history.js";

export const createHistory = async (req, res) => {
  try {
    const { negotiationId, note } = req.body;

    if (!negotiationId) {
      return res.status(400).json({
        message: "negotiationId es requerido",
      });
    }

    const history = await NegotiationHistory.create({
      negotiationId,
      note,
    });

    res.status(201).json(history);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando historial",
    });
  }
};

export const getHistoryByNegotiation = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await NegotiationHistory.findAll({
      where: { negotiationId: id },
      order: [["createdAt", "DESC"]], // 🔥 más reciente primero
    });

    res.json(history);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo historial",
    });
  }
};