// src/models/userModel.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const userModel = {
    // Cambiamos el nombre del método pero mantenemos la funcionalidad
    findByEmail: async (username) => {
      try {
        const [rows] = await db.query(
          `SELECT u.*, r.cNombreRol AS nombreRol 
           FROM tcUsuario u
           LEFT JOIN tcRol r ON u.iIdRol = r.iIdRol
           WHERE u.cNombreUsuario = ?`,
          [username]
        );
        return rows[0];
      } catch (error) {
        throw error;
      }
    },

  verifyPassword: async (providedPassword, storedPassword) => {
    return await bcrypt.compare(providedPassword, storedPassword);
  },

  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  }
};

module.exports = userModel;
