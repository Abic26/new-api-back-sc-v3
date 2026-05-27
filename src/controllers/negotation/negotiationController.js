import { Negotiation } from "../../models/negotation/negotation.js";

// ==============================
// CREAR NEGOCIACIÓN
// ==============================
export const createNegotiation = async (req, res) => {
  try {
    const { clientId, note, total } = req.body;

    const negotiation = await Negotiation.create({
      clientId,
      note,
      total,
      pdf: req.file ? req.file.path : null,
    });

    res.status(201).json(negotiation);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando negociación",
    });
  }
};

// ==============================
// ACTUALIZAR NEGOCIACIÓN
// ==============================
export const updateNegotiation = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, total, status } = req.body;

    const negotiation = await Negotiation.findByPk(id);

    if (!negotiation) {
      return res.status(404).json({
        message: "Negociación no encontrada",
      });
    }

    await negotiation.update({
      ...(note && { note }),
      ...(total && { total }),
      ...(status && { status }),
      ...(req.file && { pdf: req.file.path }),
      ...(status === "won" || status === "lost"
        ? { closedAt: new Date() }
        : {}),
    });

    res.json({
      message: "Negociación actualizada correctamente",
      negotiation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando negociación",
    });
  }
};

// ==============================
// OBTENER NEGOCIACIONES POR CLIENTE
// ==============================
export const getNegotiationsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const negotiations = await Negotiation.findAll({
      where: { clientId },
      order: [["createdAt", "DESC"]],
    });

    const totalsByStatus = negotiations.reduce(
      (acc, negotiation) => {
        const status = negotiation.status;
        const total = Number(negotiation.total) || 0;

        if (acc[status] !== undefined) {
          acc[status] += total;
        }

        return acc;
      },
      {
        pending: 0,
        won: 0,
        lost: 0,
      },
    );

    res.json({
      negotiations,
      totalsByStatus,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo negociaciones",
    });
  }
};

// ==============================
// (OPCIONAL) TODAS LAS NEGOCIACIONES
// ==============================
export const getAllNegotiations = async (req, res) => {
  try {
    const negotiations = await Negotiation.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json(negotiations);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo negociaciones",
    });
  }
};
