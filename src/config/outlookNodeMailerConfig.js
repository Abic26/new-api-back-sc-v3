import nodemailer from "nodemailer";

const outlookUser = process.env.OUTLOOK_USER?.trim();
const outlookPass = process.env.OUTLOOK_PASS?.trim();
const transporterOutlook = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: outlookUser,
    pass: outlookPass, // contraseña o app password
  },
});
export default transporterOutlook;
