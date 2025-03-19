// src/models/universidadModel.js
const db = require('../config/db');

const universidadModel = {
  findAll: async () => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM tcUniversidad WHERE bActivo = 1'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM tcUniversidad WHERE iIdUniversidad = ? AND bActivo = 1',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }
};

module.exports = universidadModel;