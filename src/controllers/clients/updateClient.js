import { Client } from "../../models/clients/client.js";

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      asesor,
      contactoCel,
      tel,
      correo,
      rut,
      pais,
      ciudad,
      userId,
      typeClient,
      potentialClient,
      notPotentialClient,
      direccion,
      barrio,
      canal
    } = req.body;

    const client = await Client.findByPk(id);

    if (!client) {
      return res.status(404).json({
        message: "Cliente no encontrado",
      });
    }

    // validar permisos
    if (req.user.role !== "admin" && client.userId !== req.user.id) {
      return res.status(403).json({
        message: "No tienes permiso para actualizar este cliente",
      });
    }

    const updateData = {
      nombre,
      asesor,
      contactoCel,
      tel,
      correo,
      rut,
      pais,
      ciudad,
      typeClient,
      potentialClient,
      notPotentialClient,
      direccion,
      barrio,
      canal
    };

    // SOLO admin puede cambiar el usuario asignado
    if (req.user.role === "admin" && userId) {
      updateData.userId = userId;
    }

    await client.update(updateData);

    res.json(client);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando cliente",
    });
  }
};
