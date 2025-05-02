// src/config/jwt.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || '/LJ+dQJOTuuUd201IbmBa0tWHTe7reItKE9TO8Gm4Qqx3DvAfzn/JMVIy3rU6NP61c8UtqC5kMiAR7yTtuCnhA==';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const generateToken = (payload) => {
  console.log(`Generando token con expiración: ${JWT_EXPIRES_IN}`); // Log para depuración
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verificado con éxito, exp:', new Date(decoded.exp * 1000).toISOString());
    return decoded;
  } catch (error) {
    console.error('Error en verificación de token:', error.message);
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  JWT_SECRET
};