import transporterOutlook from "../config/outlookNodeMailerConfig.js";


/**
 * Función reutilizable para enviar correos usando SOLO Outlook
 */
const sendOutlookMail = async ({
  to,
  subject,
  html,
  text = "",
  cc = "",
  bcc = "",
  attachments = [],
}) => {
  try {
    if (!to) {
      throw new Error("El destinatario es obligatorio");
    }

    if (!subject) {
      throw new Error("El asunto es obligatorio");
    }

    if (!html && !text) {
      throw new Error("El contenido del correo es obligatorio");
    }

    const mailOptions = {
      from: `${process.env.OUTLOOK_USER}`,
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      attachments,
    };

    const info = await transporterOutlook.sendMail(mailOptions);

    return {
      success: true,
      message: "Correo enviado correctamente",
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error al enviar correo con Outlook:", error);

    return {
      success: false,
      message: "Error al enviar correo con Outlook",
      error: error.message,
    };
  }
};

export default sendOutlookMail;