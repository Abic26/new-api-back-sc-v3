import { DataRelevant } from "../../models/clients/dataRelevant.js";

//GET por idClient
export const getDataRelevantByClient = async (req, res) => {
  try {
    const { idClient } = req.params;

    const data = await DataRelevant.findAll({
      where: { idClient },
      order: [["createdAt", "DESC"]],
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//CREATE
export const createDataRelevant = async (req, res) => {
  try {
    const { titulo, valor, idClient } = req.body;

    const newData = await DataRelevant.create({
      titulo,
      valor,
      idClient,
    });

    res.status(201).json(newData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//UPDATE
export const updateDataRelevant = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, valor } = req.body;

    const data = await DataRelevant.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: "No encontrado" });
    }

    data.titulo = titulo ?? data.titulo;
    data.valor = valor ?? data.valor;

    await data.save();

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//DELETE
export const deleteDataRelevant = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await DataRelevant.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await data.destroy();

    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};