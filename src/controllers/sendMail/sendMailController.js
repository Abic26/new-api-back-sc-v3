import { MailData } from "../../models/sendMail/mailData.js";

/**
 * ✅ Crear MailData
 */
export const createMailData = async (req, res) => {
  try {
    const { subject, template, userId } = req.body;

    const mail = await MailData.create({
      subject,
      template,
      userId,
    });

    return res.status(201).json(mail);
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      message: "Error creating MailData",
      error: error.message,
    });
  }
};

/**
 * ✅ Obtener todos por userId
 */
export const getMailDataByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const mails = await MailData.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    return res.json(mails);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching MailData",
      error: error.message,
    });
  }
};

/**
 * ✅ Obtener uno por ID
 */
export const getMailDataById = async (req, res) => {
  try {
    const { id } = req.params;

    const mail = await MailData.findByPk(id);

    if (!mail) {
      return res.status(404).json({
        message: "MailData not found",
      });
    }

    return res.json(mail);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching MailData",
      error: error.message,
    });
  }
};

/**
 * ✅ Actualizar
 */
export const updateMailData = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, template } = req.body;

    const mail = await MailData.findByPk(id);

    if (!mail) {
      return res.status(404).json({
        message: "MailData not found",
      });
    }

    await mail.update({
      subject,
      template,
    });

    return res.json(mail);
  } catch (error) {
    return res.status(500).json({
      message: "Error updating MailData",
      error: error.message,
    });
  }
};

/**
 * ✅ Eliminar
 */
export const deleteMailData = async (req, res) => {
  try {
    const { id } = req.params;

    const mail = await MailData.findByPk(id);

    if (!mail) {
      return res.status(404).json({
        message: "MailData not found",
      });
    }

    await mail.destroy();

    return res.json({
      message: "MailData deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting MailData",
      error: error.message,
    });
  }
};
