import { FollowUp } from "../../models/case/followUp.js";
import { Quote } from "../../models/case/quote.js";
import { Client } from "../../models/clients/client.js";
import User from "../../models/users/user.js";
import sendOutlookMail from "../../utils/sendOutlookMail.js";
import getBossEmailByUserName from "../../utils/getBossEmailByUserName.js";

// crear seguimiento
export const createFollowUp = async (req, res) => {
  try {
    const { clientId, note, nextFollowUp } = req.body;

    const follow = await FollowUp.create({
      clientId,
      note,
      nextFollowUp,
    });

    res.status(201).json(follow);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando seguimiento",
    });
  }
};

// crear cotización
export const createQuote = async (req, res) => {
  try {
    const { clientId, note } = req.body;

    const quote = await Quote.create({
      clientId,
      note,
      pdf: req.file.path,
    });

    res.status(201).json(quote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando cotización",
    });
  }
};

// obtener seguimientos de cliente
export const getFollowUpsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const followups = await FollowUp.findAll({
      where: { clientId },
      order: [["nextFollowUp", "DESC"]],
    });

    res.json(followups);
  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo seguimientos",
    });
  }
};

// obtener cotizaciones de cliente
export const getQuotesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const quotes = await Quote.findAll({
      where: { clientId },
      order: [["createdAt", "DESC"]],
    });

    res.json(quotes);
  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo cotizaciones",
    });
  }
};

// metodo para actualizar followUp actualizar seguimiento
export const updateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, nextFollowUp, status } = req.body;

    const follow = await FollowUp.findByPk(id);
    // Acceder al clientId
    const clientId = follow.clientId;

    // Buscar datos completos del cliente
    const client = await Client.findByPk(clientId);
    // datos del comercial que corresponde al cliente
    const user = await User.findByPk(client.userId);

    if (!follow) {
      return res.status(404).json({
        message: "Seguimiento no encontrado",
      });
    }

    await follow.update({
      note,
      nextFollowUp,
      status,
    });

    res.json({
      message: "Seguimiento actualizado correctamente",
      follow,
    });
    // envia correo para avisar el cumplimiento de la tarea

    const bossEmail = getBossEmailByUserName(user.name);

    if (!bossEmail) {
      return res.status(400).json({
        message: `No hay jefe asignado para el usuario ${user.name}`,
      });
    }
    
    await sendOutlookMail({
      to: bossEmail,
      subject: `Tarea terminada para comercial - ${user.name}`,
      html: `
        <p>El comercial ${user.name}, ya termino la tarea: ${follow.note} del cliente ${client.nombre}.</p>
      `,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando seguimiento",
    });
  }
};

export const getPendingFollowUpsGrouped = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "No autorizado",
      });
    }

    // 🔥 filtro dinámico según rol
    const whereClient =
      req.user.role === "admin" ? {} : { userId: req.user.id };

    const clients = await Client.findAll({
      where: whereClient,
      include: [
        {
          model: FollowUp,
          where: { status: false }, // 🔥 solo pendientes
          required: false,
          attributes: ["id", "note", "nextFollowUp"],
        },
      ],
      order: [[FollowUp, "nextFollowUp", "ASC"]],
    });

    // 🔥 formateo
    const result = clients.map((client) => {
      const tareas = client.FollowUps || [];

      return {
        id: client.id,
        nombre: client.nombre,
        totalTareas: tareas.length,

        tareas: tareas.map((t) => ({
          id: t.id,
          note: t.note,
          nextFollowUp: t.nextFollowUp,
        })),
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo tareas pendientes",
    });
  }
};
