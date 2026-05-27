import { Wallet } from "../../models/wallet/wallet.js";
import { Client } from "../../models/clients/client.js";
import User from "../../models/users/user.js";
import { Op } from "sequelize";

const parsePositiveInteger = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseBooleanFilter = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const buildClientFilters = (req) => {
  const where = {};
  const search = String(req.query.search || "").trim();
  const potentialClient = parseBooleanFilter(req.query.potentialClient);

  if (req.user.role !== "admin") {
    where.userId = req.user.id;
  } else if (req.query.userId) {
    where.userId = req.query.userId;
  }

  if (search) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${search}%` } },
      { asesor: { [Op.iLike]: `%${search}%` } },
      { contactoCel: { [Op.iLike]: `%${search}%` } },
      { tel: { [Op.iLike]: `%${search}%` } },
      { correo: { [Op.iLike]: `%${search}%` } },
      { rut: { [Op.iLike]: `%${search}%` } },
      { ciudad: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (potentialClient !== null) {
    where.potentialClient = potentialClient;
  }

  return where;
};

const userInclude = (req) => ({
  model: User,
  attributes:
    req.user.role === "admin"
      ? ["id", "name", "email", "role"]
      : ["id", "name", "email"],
});

export const getClients = async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;
    const where = buildClientFilters(req);
    const include = [userInclude(req)];

    if (wantsPagination) {
      const page = parsePositiveInteger(req.query.page, 1, 100000);
      const limit = parsePositiveInteger(req.query.limit, 20, 100);
      const offset = (page - 1) * limit;

      const { rows, count } = await Client.findAndCountAll({
        where,
        include,
        order: [["nombre", "ASC"]],
        limit,
        offset,
        distinct: true,
      });

      return res.json({
        data: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.max(Math.ceil(count / limit), 1),
        },
      });
    }

    const clients = await Client.findAll({
      where,
      order: [["nombre", "ASC"]],
      include,
    });

    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo clientes",
    });
  }
};

export const getClientsWalletStatus = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let clients;

    if (req.user.role === "admin") {
      clients = await Client.findAll({
        include: [
          {
            model: Wallet,
            as: "wallets",
            attributes: [
              "id",
              "numeroFactura",
              "fechaFactura",
              "fechaVencimiento",
              "fechaSiniestro",
              "saldoReal",
              "status",
            ],
          },
        ],
      });
    } else {
      clients = await Client.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: Wallet,
            as: "wallets",
            attributes: [
              "id",
              "numeroFactura",
              "fechaFactura",
              "fechaVencimiento",
              "fechaSiniestro",
              "saldoReal",
              "status",
            ],
          },
        ],
      });
    }

    const result = clients.map((client) => {
      let vencidos = 0;
      let siniestros = 0;
      let alDia = 0;
      // 💰 nuevos acumuladores
      let saldoVencidos = 0;
      let saldoSiniestros = 0;
      let saldoAlDia = 0;

      const detalle = {
        vencidos: [],
        siniestros: [],
        alDia: [],
      };

      client.wallets.forEach((w) => {
        // 🔥 ignorar si ya pagó
        if (w.saldoReal <= 0 || w.status === true) return;

        const fechaVencimiento = new Date(w.fechaVencimiento + "T00:00:00");
        const fechaSiniestro = new Date(w.fechaSiniestro + "T00:00:00");
        

        const facturaData = {
          id: w.id,
          numeroFactura: w.numeroFactura,
          fechaFactura: w.fechaFactura,
          fechaVencimiento: fechaVencimiento,
          fechaSiniestro: fechaSiniestro,
          saldoReal: w.saldoReal,
        };

        // 🔥 prioridad: siniestro > vencido
        if (today >= fechaSiniestro) {
          siniestros++;
          saldoSiniestros += Number(w.saldoReal);
          detalle.siniestros.push(facturaData);
        } else if (today >= fechaVencimiento) {
          vencidos++;
          saldoVencidos += Number(w.saldoReal);
          detalle.vencidos.push(facturaData);
        } else {
          alDia++;
          saldoAlDia += Number(w.saldoReal);
          detalle.alDia.push(facturaData);
        }
      });

      return {
        id: client.id,
        nombre: client.nombre,
        vencidos,
        siniestros,
        alDia,
        total: vencidos + siniestros + alDia,
        // 💰 saldos
        saldoVencidos,
        saldoSiniestros,
        saldoAlDia,
        saldoTotal: saldoVencidos + saldoSiniestros + saldoAlDia,

        detalle,
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error obteniendo estado de cartera",
    });
  }
};
