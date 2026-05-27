import multer from "multer";
import path from "path";

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "storage/quotes");

  },

  filename: (req, file, cb) => {

    const uniqueName =
      Date.now() + "-" + file.originalname;

    cb(null, uniqueName);

  }

});

export const uploadQuote = multer({

  storage,

  fileFilter: (req, file, cb) => {

    if (file.mimetype !== "application/pdf") {

      return cb(new Error("Solo se permiten PDFs"));

    }

    cb(null, true);

  }

});