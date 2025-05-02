// src/middlewares/auth.js
const { verifyToken } = require('../config/jwt');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');

const protect = asyncHandler(async (req, res, next) => {
  // 1) Obtener el token
  let token;
  if (token) {
    // Decodificar el token sin verificar para ver su contenido
    const decoded = jwt.decode(token);
    console.log('Token exp timestamp:', decoded.exp);
    console.log('Tiempo actual timestamp:', Math.floor(Date.now() / 1000));
    console.log('Diferencia en segundos:', decoded.exp - Math.floor(Date.now() / 1000));
  }
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token recibido en solicitud:', token.substring(0, 20) + '...'); // Muestra solo el inicio del token
  }

  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'No estás autenticado. Por favor inicia sesión.'
    });
  }

  // 2) Verificar el token
  try {
    const decoded = verifyToken(token);
    console.log('Token decodificado:', decoded); // Log para depuración
    
    // 3) Guardar el usuario en req para uso posterior
    req.user = {
      id: decoded.id,
      roleId: decoded.roleId,
      universidadId: decoded.universidadId
    };
    
    next();
  } catch (error) {
    console.error('Error verificando token:', error.message); // Log detallado del error
    return res.status(401).json({
      status: 'fail',
      message: 'Token inválido o expirado'
    });
  }
});

// Middleware para restricción de roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles es un array: ['admin', 'editor']
    if (!roles.includes(req.user.roleId)) {
      return res.status(403).json({
        status: 'fail',
        message: 'No tienes permiso para realizar esta acción'
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };