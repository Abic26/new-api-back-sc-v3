import { Client } from "../../models/clients/client.js";

export const createClient = async (req, res) => {
  try {
    const {
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
      canal,
    } = req.body;

    const client = await Client.create({
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
      canal,
      userId: req.user.id,
    });

    res.status(201).json(client);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando cliente",
    });
  }
};
