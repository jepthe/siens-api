// src/models/userModel.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const userModel = {

  findById: async (userId) => {
    try {
      const [rows] = await db.query(
        `SELECT u.*, r.cNombreRol AS nombreRol, d.cCorreo, d.cNombreCompleto 
         FROM tdusuario u
         LEFT JOIN tcrol r ON u.iIdRol = r.iIdRol
         LEFT JOIN tddetallesusuario d ON u.iIdUsuario = d.iIdUsuario
         WHERE u.iIdUsuario = ?`,
        [userId]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  findByUsername: async (username) => {
    try {
      const [rows] = await db.query(
        `SELECT u.*, r.cNombreRol AS nombreRol, d.cCorreo, d.cNombreCompleto 
         FROM tdusuario u
         LEFT JOIN tcrol r ON u.iIdRol = r.iIdRol
         LEFT JOIN tddetallesusuario d ON u.iIdUsuario = d.iIdUsuario
         WHERE u.cNombreUsuario = ?`,
        [username]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Método para buscar usuario por nombre de usuario
  findByEmail: async (email) => {
    try {
      const [rows] = await db.query(
        `SELECT u.*, r.cNombreRol AS nombreRol, d.cCorreo, d.cNombreCompleto 
         FROM tdusuario u
         LEFT JOIN tcrol r ON u.iIdRol = r.iIdRol
         LEFT JOIN tddetallesusuario d ON u.iIdUsuario = d.iIdUsuario
         WHERE d.cCorreo = ?`,
        [email]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },
  
  // Método para buscar usuario por correo electrónico
  findUserByEmail: async (email) => {
    try {
      const [rows] = await db.query(
        `SELECT u.*, d.cCorreo, d.cNombreCompleto 
         FROM tdusuario u
         INNER JOIN tddetallesusuario d ON u.iIdUsuario = d.iIdUsuario
         WHERE d.cCorreo = ?`,
        [email]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },
  
  // Verificar si una contraseña ya existe en la base de datos
  checkPasswordExists: async (password) => {
    try {
      // Esto es solo para verificar si la contraseña en texto plano ya existe
      // Es un método simplificado para el proceso de recuperación de contraseña
      const [rows] = await db.query(
        'SELECT COUNT(*) as count FROM tdusuario WHERE cContraseña = ?',
        [password]
      );
      
      return rows[0].count > 0;
    } catch (error) {
      throw error;
    }
  },
  
  // Método para actualizar la contraseña de un usuario
  updatePassword: async (userId, password) => {
    try {
      // Guarda la contraseña en texto plano para que el usuario pueda usarla después de recibir el correo
      await db.query(
        'UPDATE tdusuario SET cContraseña = ? WHERE iIdUsuario = ?',
        [password, userId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  },
  
  // Método para actualizar la contraseña a una versión hasheada
  // Este método se usaría después de un inicio de sesión exitoso con una contraseña en texto plano
  upgradePasswordToHashed: async (userId, password) => {
    try {
      console.log('Iniciando hasheo de contraseña para usuario ID:', userId);
      console.log('Contraseña a hashear:', password);
      
      const hashedPassword = await bcrypt.hash(password, 12);
      console.log('Hash generado:', hashedPassword);
      
      await db.query(
        'UPDATE tdusuario SET cContraseña = ? WHERE iIdUsuario = ?',
        [hashedPassword, userId]
      );
      
      console.log('Contraseña hasheada guardada en base de datos');
      return true;
    } catch (error) {
      console.error('Error en upgradePasswordToHashed:', error);
      throw error;
    }
  },
  
  // Método para establecer una nueva contraseña hasheada (usado en cambio de contraseña)
  setHashedPassword: async (userId, plainPassword) => {
    try {
      const hashedPassword = await bcrypt.hash(plainPassword, 12);
      await db.query(
        'UPDATE tdusuario SET cContraseña = ? WHERE iIdUsuario = ?',
        [hashedPassword, userId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  },

  // Verificar contraseña (maneja tanto hashed como texto plano)
  verifyPassword: async (providedPassword, storedPassword) => {
    if (storedPassword.startsWith('$2')) {
      // La contraseña está hasheada con bcrypt
      return await bcrypt.compare(providedPassword, storedPassword);
    } else {
      // La contraseña está en texto plano
      return providedPassword === storedPassword;
    }
  },

  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  }
};

module.exports = userModel;