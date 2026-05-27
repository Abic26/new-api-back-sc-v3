import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AuthSession from "../../models/auth/authSession.js";
import User from "../../models/users/user.js";

const SESSION_DAYS = 7;

const sessionExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  return expiresAt;
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    const session = await AuthSession.create({
      userId: user.id,
      userAgent: req.get("user-agent") || null,
      ipAddress: req.ip || null,
      expiresAt: sessionExpiresAt(),
      lastUsedAt: new Date(),
    });

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
        sessionId: session.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: `${SESSION_DAYS}d` },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    res.status(500).json(error);
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash,
      role,
      phone,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json(error);
  }
};

export const getUsers = async (req, res) => {
  try {
    // solo admin puede ver usuarios
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "No tienes permiso para ver los usuarios",
      });
    }

    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "phone"],
      order: [["name", "ASC"]],
    });

    res.json(users);
  } catch (error) {
    console.error("ERROR GET USERS:", error);

    res.status(500).json({
      message: "Error obteniendo usuarios",
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    // validar que sea admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "No tienes permiso para actualizar usuarios",
      });
    }

    const { id } = req.params;
    const { name, email, password, role, phone } = req.body;

    // buscar usuario
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    // si envían password → encriptar
    let updatedData = {
      name,
      email,
      role,
      phone,
    };

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updatedData.password = hash;
      updatedData.tokenVersion = user.tokenVersion + 1;
    }

    await user.update(updatedData);

    res.json({
      message: "Usuario actualizado correctamente",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("ERROR UPDATE USER:", error);
    res.status(500).json({
      message: "Error actualizando usuario",
    });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.session?.id) {
      await AuthSession.update(
        { revokedAt: new Date() },
        {
          where: {
            id: req.session.id,
            userId: req.user.id,
            revokedAt: null,
          },
        },
      );
    }

    return res.json({
      message: "Sesión cerrada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error cerrando sesión",
    });
  }
};
