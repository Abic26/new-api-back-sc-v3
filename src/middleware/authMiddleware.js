import jwt from "jsonwebtoken";
import AuthSession from "../models/auth/authSession.js";
import User from "../models/users/user.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];

    // 🔥 1. Validar firma
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 2. Buscar usuario REAL en BD
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "Usuario no válido",
      });
    }

    // 🔥 3. Validar tokenVersion (ANTI ROBO)
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        message: "Sesión inválida",
      });
    }

    if (!decoded.sessionId) {
      return res.status(401).json({
        message: "Sesión inválida",
      });
    }

    const session = await AuthSession.findOne({
      where: {
        id: decoded.sessionId,
        userId: user.id,
        revokedAt: null,
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      return res.status(401).json({
        message: "Sesión inválida",
      });
    }

    await session.update({ lastUsedAt: new Date() });

    // 🔥 4. USAR DATOS REALES
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };
    req.session = {
      id: session.id,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido o expirado",
    });
  }
};
