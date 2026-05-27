import { TaskUser } from "../../models/tasks/task.js";
import User from "../../models/users/user.js";
import sendOutlookMail from "../../utils/sendOutlookMail.js";
import getBossEmailByUserName from "../../utils/getBossEmailByUserName.js";

export const createTask = async (req, res) => {
  try {
    const { task, nextFollowUp, userId, status, observations } = req.body;

    if (!task) {
      return res.status(400).json({
        message: "La tarea es requerida",
      });
    }

    const assignedUserId =
      req.user.role === "admin" && userId ? userId : req.user.id;

    const user = await User.findByPk(assignedUserId);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    const newTask = await TaskUser.create({
      task,
      nextFollowUp,
      userId: assignedUserId,
      status,
      observations,
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creando tarea",
    });
  }
};

export const getTasks = async (req, res) => {
  try {
    const whereTask = req.user.role === "admin" ? {} : { userId: req.user.id };

    const tasks = await TaskUser.findAll({
      where: whereTask,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["nextFollowUp", "DESC"]],
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo tareas",
    });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const whereTask = req.user.role === "admin" ? {} : { userId: req.user.id };

    const tasks = await TaskUser.findAll({
      where: whereTask,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["nextFollowUp", "DESC"]],
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo tareas del usuario",
    });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { task, nextFollowUp, userId, status, observations } = req.body;

    const taskUser = await TaskUser.findByPk(id);

    if (!taskUser) {
      return res.status(404).json({
        message: "Tarea no encontrada",
      });
    }

    if (req.user.role !== "admin" && taskUser.userId !== req.user.id) {
      return res.status(403).json({
        message: "No tienes permiso para actualizar esta tarea",
      });
    }

    const updateData = {
      task,
      nextFollowUp,
      status,
      observations,
    };

    if (req.user.role === "admin" && userId) {
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          message: "Usuario no encontrado",
        });
      }

      updateData.userId = userId;
    }

    await taskUser.update(updateData);
    res.json({
      message: "Tarea actualizada correctamente",
      task: taskUser,
      mail: mailResult,
    });

    const assignedUser = await User.findByPk(taskUser.userId);
    let mailResult = null;

    if (status === true && assignedUser) {
      const bossEmail = getBossEmailByUserName(assignedUser.name);

      if (bossEmail) {
        mailResult = await sendOutlookMail({
          to: bossEmail,
          subject: `Tarea terminada para asesor - ${assignedUser.name}`,
          html: `
            <p>El asesor <strong>${assignedUser.name}</strong> completó la tarea:</p>
            <p><strong>${taskUser.task}</strong></p>
            <p>Observaciones:</p>
            <p>${taskUser.observations || "Sin observaciones"}</p>
          `,
        });
      } else {
        mailResult = {
          success: false,
          message: `No hay jefe asignado para el usuario ${assignedUser.name}`,
        };
      }
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando tarea",
    });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await TaskUser.findByPk(id);

    if (!task) {
      return res.status(404).json({
        message: "Tarea no encontrada",
      });
    }

    if (req.user.role !== "admin" && task.userId !== req.user.id) {
      return res.status(403).json({
        message: "No tienes permiso para eliminar esta tarea",
      });
    }

    await task.destroy();

    res.json({
      message: "Tarea eliminada correctamente",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error eliminando tarea",
    });
  }
};
